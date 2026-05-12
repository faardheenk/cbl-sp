/* eslint-disable no-console */
const path = require("path");
const XLSX = require("xlsx");

const workbookPath =
  process.argv[2] || path.join(__dirname, "..", "data", "output.xlsx");

const SHARED_ROW_METADATA = new Set([
  "group_id",
  "match_group",
  "match_condition",
]);

function buildBucketRowId(bucket, index) {
  const prefix =
    bucket === "exact" ? "EM" : bucket === "partial" ? "PM" : "NM";
  return `${prefix}-${index}`;
}

function isBlankRow(row) {
  return (
    !row ||
    row.ProcessedAmount === undefined ||
    row.ProcessedAmount === null ||
    row.ProcessedAmount === ""
  );
}

function getGroupId(row) {
  const raw = row && row.group_id;
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim();
  return value || null;
}

function regenerateIdx(rows, bucket = "partial") {
  return rows.map((row, index) => ({
    ...row,
    idx: buildBucketRowId(bucket, index),
  }));
}

function splitData(rows, bucket = "partial") {
  const cbl = [];
  const insurer = [];

  rows.forEach((row, index) => {
    const cblRow = { idx: buildBucketRowId(bucket, index) };
    const insurerRow = { idx: buildBucketRowId(bucket, index) };

    Object.keys(row).forEach((key) => {
      if (key.endsWith("_INSURER")) {
        insurerRow[key.replace("_INSURER", "")] = row[key];
      } else if (SHARED_ROW_METADATA.has(key)) {
        cblRow[key] = row[key];
        insurerRow[key] = row[key];
      } else {
        cblRow[key] = row[key];
      }
    });

    cbl.push(cblRow);
    insurer.push(insurerRow);
  });

  return { cbl, insurer };
}

function mergeData(cbl, insurer) {
  return cbl.map((cblRow, index) => {
    const insurerRow = insurer[index] || {};
    const merged = { ...cblRow };

    Object.keys(insurerRow).forEach((key) => {
      if (SHARED_ROW_METADATA.has(key)) return;
      if (key === "idx") {
        merged.idx = insurerRow.idx;
        return;
      }
      merged[`${key}_INSURER`] = insurerRow[key] === "" ? null : insurerRow[key];
    });

    return merged;
  });
}

function createBlankSpacerRow(removedRow, oppositeRow) {
  const template = removedRow || oppositeRow || {};
  const spacer = Object.keys(template).reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});

  const groupId = getGroupId(removedRow) || getGroupId(oppositeRow);
  if (groupId) spacer.group_id = groupId;

  const matchGroup =
    (removedRow && removedRow.match_group) ||
    (oppositeRow && oppositeRow.match_group);
  if (matchGroup !== undefined && matchGroup !== null && matchGroup !== "") {
    spacer.match_group = matchGroup;
  }

  const matchCondition =
    (removedRow && removedRow.match_condition) ||
    (oppositeRow && oppositeRow.match_condition);
  if (
    matchCondition !== undefined &&
    matchCondition !== null &&
    matchCondition !== ""
  ) {
    spacer.match_condition = matchCondition;
  }

  return spacer;
}

function removeRowsPreservingOneSidedSpacers(
  rows,
  oppositeRows,
  rowsToRemove,
  oppositeRowsToRemove,
) {
  const updatedRows = [];
  const rowsToMove = [];

  rows.forEach((row, index) => {
    if (!rowsToRemove.has(row.idx)) {
      updatedRows.push(row);
      return;
    }

    rowsToMove.push(row);

    const oppositeRow = oppositeRows[index];
    if (
      oppositeRow &&
      !isBlankRow(oppositeRow) &&
      !oppositeRowsToRemove.has(oppositeRow.idx)
    ) {
      updatedRows.push(createBlankSpacerRow(row, oppositeRow));
    }
  });

  return { updatedRows, rowsToMove };
}

function groupRows(rows, groupId, includeBlank = true) {
  return rows.filter((row) => {
    if (getGroupId(row) !== groupId) return false;
    return includeBlank || !isBlankRow(row);
  });
}

function getTouchedGroupIds(bucket, selectedCblIds, selectedInsurerIds) {
  const groupIds = new Set();

  bucket.cbl.forEach((row) => {
    if (selectedCblIds.has(row.idx) && getGroupId(row)) {
      groupIds.add(getGroupId(row));
    }
  });
  bucket.insurer.forEach((row) => {
    if (selectedInsurerIds.has(row.idx) && getGroupId(row)) {
      groupIds.add(getGroupId(row));
    }
  });

  return groupIds;
}

function moveFromMatchedBucket(bucket, selectedCblIds, selectedInsurerIds) {
  const touchedGroupIds = getTouchedGroupIds(
    bucket,
    selectedCblIds,
    selectedInsurerIds,
  );

  const orphanedInsurerIds = new Set();
  const orphanedCblIds = new Set();

  touchedGroupIds.forEach((groupId) => {
    const realCblRows = groupRows(bucket.cbl, groupId, false);
    const realInsurerRows = groupRows(bucket.insurer, groupId, false);

    const allRealCblRemoved =
      realCblRows.length > 0 &&
      realCblRows.every((row) => selectedCblIds.has(row.idx));
    const allRealInsurerRemoved =
      realInsurerRows.length > 0 &&
      realInsurerRows.every((row) => selectedInsurerIds.has(row.idx));

    if (allRealCblRemoved) {
      realInsurerRows.forEach((row) => {
        if (!selectedInsurerIds.has(row.idx)) {
          orphanedInsurerIds.add(row.idx);
        }
      });
    }

    if (allRealInsurerRemoved) {
      realCblRows.forEach((row) => {
        if (!selectedCblIds.has(row.idx)) {
          orphanedCblIds.add(row.idx);
        }
      });
    }
  });

  const cblIdsToRemove = new Set([...selectedCblIds, ...orphanedCblIds]);
  const insurerIdsToRemove = new Set([
    ...selectedInsurerIds,
    ...orphanedInsurerIds,
  ]);

  const cblRemoval = removeRowsPreservingOneSidedSpacers(
    bucket.cbl,
    bucket.insurer,
    cblIdsToRemove,
    insurerIdsToRemove,
  );
  const insurerRemoval = removeRowsPreservingOneSidedSpacers(
    bucket.insurer,
    bucket.cbl,
    insurerIdsToRemove,
    cblIdsToRemove,
  );

  const fullyMovedGroupIds = new Set();
  touchedGroupIds.forEach((groupId) => {
    const realCblRows = groupRows(bucket.cbl, groupId, false);
    const realInsurerRows = groupRows(bucket.insurer, groupId, false);
    const allRealCblRemoved =
      realCblRows.length > 0 &&
      realCblRows.every((row) => cblIdsToRemove.has(row.idx));
    const allRealInsurerRemoved =
      realInsurerRows.length > 0 &&
      realInsurerRows.every((row) => insurerIdsToRemove.has(row.idx));

    if (allRealCblRemoved && allRealInsurerRemoved) {
      fullyMovedGroupIds.add(groupId);
    }
  });

  const source = {
    cbl: regenerateIdx(
      cblRemoval.updatedRows.filter(
        (row) =>
          !(
            isBlankRow(row) &&
            getGroupId(row) &&
            fullyMovedGroupIds.has(getGroupId(row))
          ),
      ),
    ),
    insurer: regenerateIdx(
      insurerRemoval.updatedRows.filter(
        (row) =>
          !(
            isBlankRow(row) &&
            getGroupId(row) &&
            fullyMovedGroupIds.has(getGroupId(row))
          ),
      ),
    ),
  };

  const destination = {
    cbl: cblRemoval.rowsToMove.filter((row) => selectedCblIds.has(row.idx)),
    insurer: insurerRemoval.rowsToMove.filter((row) =>
      selectedInsurerIds.has(row.idx),
    ),
  };

  const noMatch = {
    cbl: cblRemoval.rowsToMove.filter((row) => orphanedCblIds.has(row.idx)),
    insurer: insurerRemoval.rowsToMove.filter((row) =>
      orphanedInsurerIds.has(row.idx),
    ),
  };

  return { source, destination, noMatch };
}

function cleanRowsForNoMatch(rows) {
  return rows.map((row) => {
    const {
      group_id: _groupId,
      match_group: _matchGroup,
      match_condition: _matchCondition,
      matched_insurer_indices: _matchedInsurerIndices,
      ...rest
    } = row;
    return rest;
  });
}

function addGroupAndCondition(rows, groupId) {
  return rows.map((row) => ({
    ...row,
    group_id: groupId,
    match_group: "1",
    match_condition: "manual match",
  }));
}

function equalizeMatchedRows(cblRows, insurerRows, groupId) {
  const cbl = [...cblRows];
  const insurer = [...insurerRows];

  while (cbl.length < insurer.length) {
    cbl.push(createBlankSpacerRow(cbl[0] || {}, insurer[cbl.length]));
    cbl[cbl.length - 1].group_id = groupId;
  }

  while (insurer.length < cbl.length) {
    insurer.push(createBlankSpacerRow(insurer[0] || {}, cbl[insurer.length]));
    insurer[insurer.length - 1].group_id = groupId;
  }

  return { cbl, insurer };
}

function applyMatchedToMatchedMove(
  sourceBucket,
  destinationBucket,
  selectedCblIds,
  selectedInsurerIds,
  destinationGroupId = "DEST-G1",
) {
  const moved = moveFromMatchedBucket(
    sourceBucket,
    selectedCblIds,
    selectedInsurerIds,
  );
  const destinationRows = equalizeMatchedRows(
    addGroupAndCondition(moved.destination.cbl, destinationGroupId),
    addGroupAndCondition(moved.destination.insurer, destinationGroupId),
    destinationGroupId,
  );

  return {
    source: moved.source,
    destination: {
      cbl: regenerateIdx([...destinationBucket.cbl, ...destinationRows.cbl]),
      insurer: regenerateIdx([
        ...destinationBucket.insurer,
        ...destinationRows.insurer,
      ]),
    },
    noMatch: moved.noMatch,
  };
}

function applyMatchedToNoMatchMove(
  sourceBucket,
  noMatchBucket,
  selectedCblIds,
  selectedInsurerIds,
) {
  const moved = moveFromMatchedBucket(
    sourceBucket,
    selectedCblIds,
    selectedInsurerIds,
  );

  return {
    source: moved.source,
    noMatch: {
      cbl: regenerateIdx(
        cleanRowsForNoMatch([
          ...noMatchBucket.cbl,
          ...moved.destination.cbl,
          ...moved.noMatch.cbl,
        ]),
        "no-match",
      ),
      insurer: regenerateIdx(
        cleanRowsForNoMatch([
          ...noMatchBucket.insurer,
          ...moved.destination.insurer,
          ...moved.noMatch.insurer,
        ]),
        "no-match",
      ),
    },
  };
}

function createNoMatchFixture() {
  return {
    cbl: [
      {
        idx: buildBucketRowId("no-match", 0),
        ClientName: "NM CBL 1",
        ProcessedAmount: -10,
        _fingerprint: "nm-cbl-1",
      },
      {
        idx: buildBucketRowId("no-match", 1),
        ClientName: "NM CBL 2",
        ProcessedAmount: -20,
        _fingerprint: "nm-cbl-2",
      },
      {
        idx: buildBucketRowId("no-match", 2),
        ClientName: "NM CBL 3",
        ProcessedAmount: -30,
        _fingerprint: "nm-cbl-3",
      },
    ],
    insurer: [
      {
        idx: buildBucketRowId("no-match", 0),
        ClientName: "NM insurer 1",
        ProcessedAmount: 8,
        _fingerprint: "nm-ins-1",
      },
      {
        idx: buildBucketRowId("no-match", 1),
        ClientName: "NM insurer 2",
        ProcessedAmount: 12,
        _fingerprint: "nm-ins-2",
      },
      {
        idx: buildBucketRowId("no-match", 2),
        ClientName: "NM insurer 3",
        ProcessedAmount: 18,
        _fingerprint: "nm-ins-3",
      },
    ],
  };
}

function applyNoMatchToMatchedMove(
  noMatchBucket,
  destinationBucket,
  selectedCblIds,
  selectedInsurerIds,
  destinationGroupId = "NM-DEST-G1",
) {
  const selectedCblRows = noMatchBucket.cbl.filter((row) =>
    selectedCblIds.has(row.idx),
  );
  const selectedInsurerRows = noMatchBucket.insurer.filter((row) =>
    selectedInsurerIds.has(row.idx),
  );
  const destinationRows = equalizeMatchedRows(
    addGroupAndCondition(selectedCblRows, destinationGroupId),
    addGroupAndCondition(selectedInsurerRows, destinationGroupId),
    destinationGroupId,
  );

  return {
    source: {
      cbl: regenerateIdx(
        noMatchBucket.cbl.filter((row) => !selectedCblIds.has(row.idx)),
        "no-match",
      ),
      insurer: regenerateIdx(
        noMatchBucket.insurer.filter((row) => !selectedInsurerIds.has(row.idx)),
        "no-match",
      ),
    },
    destination: {
      cbl: regenerateIdx([...destinationBucket.cbl, ...destinationRows.cbl]),
      insurer: regenerateIdx([
        ...destinationBucket.insurer,
        ...destinationRows.insurer,
      ]),
    },
  };
}

function createFixtureBucket() {
  const cbl = [];
  const insurer = [];

  for (let i = 0; i < 5; i += 1) {
    cbl.push(
      i < 3
        ? {
            idx: buildBucketRowId("partial", i),
            group_id: "G1",
            match_group: "1",
            ClientName: `G1 CBL ${i + 1}`,
            ProcessedAmount: -100 - i,
            _fingerprint: `cbl-g1-${i + 1}`,
          }
        : {
            idx: buildBucketRowId("partial", i),
            group_id: "G1",
            match_group: "1",
            ClientName: "",
            ProcessedAmount: "",
          },
    );
    insurer.push({
      idx: buildBucketRowId("partial", i),
      group_id: "G1",
      match_group: "1",
      ClientName: `G1 insurer ${i + 1}`,
      ProcessedAmount: 60 + i,
      _fingerprint: `ins-g1-${i + 1}`,
    });
  }

  cbl.push({
    idx: buildBucketRowId("partial", 5),
    group_id: "G2",
    match_group: "2",
    ClientName: "G2 CBL 1",
    ProcessedAmount: -200,
    _fingerprint: "cbl-g2-1",
  });
  insurer.push({
    idx: buildBucketRowId("partial", 5),
    group_id: "G2",
    match_group: "2",
    ClientName: "G2 insurer 1",
    ProcessedAmount: 200,
    _fingerprint: "ins-g2-1",
  });

  return { cbl, insurer };
}

function counts(bucket, groupId) {
  return {
    realCbl: groupRows(bucket.cbl, groupId, false).length,
    realInsurer: groupRows(bucket.insurer, groupId, false).length,
    cblSpacers: groupRows(bucket.cbl, groupId, true).filter(isBlankRow).length,
    insurerSpacers: groupRows(bucket.insurer, groupId, true).filter(isBlankRow)
      .length,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoCrossGroupPairing(bucket) {
  assert(
    bucket.cbl.length === bucket.insurer.length,
    `matched bucket sides should remain equal length (${bucket.cbl.length} vs ${bucket.insurer.length})`,
  );

  const merged = mergeData(bucket.cbl, bucket.insurer);
  merged.forEach((row, index) => {
    const cblGroup = getGroupId(bucket.cbl[index]);
    const insurerGroup = getGroupId(bucket.insurer[index]);
    if (!isBlankRow(bucket.cbl[index]) && !isBlankRow(bucket.insurer[index])) {
      assert(
        cblGroup === insurerGroup,
        `non-blank row pair at index ${index} crosses groups (${cblGroup} vs ${insurerGroup})`,
      );
    }
    assert(row, "merged row should exist");
  });
}

function countRowsWithAmount(rows, amountKey = "ProcessedAmount") {
  return rows.filter((row) => {
    const value = row && row[amountKey];
    return value !== undefined && value !== null && value !== "";
  }).length;
}

function sumRowsByAmount(rows, amountKey = "ProcessedAmount") {
  return rows.reduce((sum, row) => {
    const value = Number(row && row[amountKey]);
    return sum + (Number.isNaN(value) ? 0 : value);
  }, 0);
}

function assertNoMatchRowsAreClean(noMatchBucket) {
  [...noMatchBucket.cbl, ...noMatchBucket.insurer].forEach((row) => {
    assert(!("group_id" in row), "no-match row should not keep group_id");
    assert(!("match_group" in row), "no-match row should not keep match_group");
    assert(
      !("match_condition" in row),
      "no-match row should not keep match_condition",
    );
    assert(
      !("matched_insurer_indices" in row),
      "no-match row should not keep matched_insurer_indices",
    );
  });
}

function runSyntheticMoveScenarios() {
  const tests = [];

  function test(name, fn) {
    tests.push({ name, fn });
  }

  test("one-sided CBL move inserts a CBL spacer and preserves insurer rows", () => {
    const bucket = createFixtureBucket();
    const result = moveFromMatchedBucket(
      bucket,
      new Set(["PM-1"]),
      new Set(),
    );
    const g1 = counts(result.source, "G1");

    assert(g1.realCbl === 2, "G1 should have 2 real CBL rows left");
    assert(g1.realInsurer === 5, "G1 should keep all 5 insurer rows");
    assert(g1.cblSpacers === 3, "G1 should have original 2 + inserted CBL spacers");
    assert(result.noMatch.insurer.length === 0, "no insurer row should be orphaned");
    assertNoCrossGroupPairing(result.source);
  });

  test("one-sided insurer move inserts an insurer spacer and preserves CBL rows", () => {
    const bucket = createFixtureBucket();
    const result = moveFromMatchedBucket(
      bucket,
      new Set(),
      new Set(["PM-1"]),
    );
    const g1 = counts(result.source, "G1");

    assert(g1.realCbl === 3, "G1 should keep all 3 CBL rows");
    assert(g1.realInsurer === 4, "G1 should have 4 insurer rows left");
    assert(g1.insurerSpacers === 1, "G1 should have one inserted insurer spacer");
    assert(result.noMatch.cbl.length === 0, "no CBL row should be orphaned");
    assertNoCrossGroupPairing(result.source);
  });

  test("remaining CBL rows plus partial insurer selection orphan unselected insurer rows", () => {
    const firstMove = moveFromMatchedBucket(
      createFixtureBucket(),
      new Set(["PM-1"]),
      new Set(),
    );

    const remainingCblIds = groupRows(firstMove.source.cbl, "G1", false).map(
      (row) => row.idx,
    );
    const selectedInsurerIds = groupRows(
      firstMove.source.insurer,
      "G1",
      false,
    )
      .slice(0, 3)
      .map((row) => row.idx);

    const secondMove = moveFromMatchedBucket(
      firstMove.source,
      new Set(remainingCblIds),
      new Set(selectedInsurerIds),
    );
    const g1 = counts(secondMove.source, "G1");

    assert(g1.realCbl === 0, "G1 should have no real CBL rows left");
    assert(g1.realInsurer === 0, "G1 should have no real insurer rows left");
    assert(g1.cblSpacers === 0, "G1 CBL spacers should be removed");
    assert(g1.insurerSpacers === 0, "G1 insurer spacers should be removed");
    assert(secondMove.destination.cbl.length === 2, "2 CBL rows should move to destination");
    assert(
      secondMove.destination.insurer.length === 3,
      "3 selected insurer rows should move to destination",
    );
    assert(
      secondMove.noMatch.insurer.length === 2,
      "2 unselected insurer rows should move to no-match as orphaned",
    );
    assertNoCrossGroupPairing(secondMove.source);
  });

  test("moving the full remaining group removes prior spacers", () => {
    const firstMove = moveFromMatchedBucket(
      createFixtureBucket(),
      new Set(["PM-1"]),
      new Set(),
    );

    const remainingCblIds = groupRows(firstMove.source.cbl, "G1", false).map(
      (row) => row.idx,
    );
    const remainingInsurerIds = groupRows(
      firstMove.source.insurer,
      "G1",
      false,
    ).map((row) => row.idx);

    const secondMove = moveFromMatchedBucket(
      firstMove.source,
      new Set(remainingCblIds),
      new Set(remainingInsurerIds),
    );
    const g1 = counts(secondMove.source, "G1");

    assert(g1.realCbl === 0, "G1 should have no real CBL rows left");
    assert(g1.realInsurer === 0, "G1 should have no real insurer rows left");
    assert(g1.cblSpacers === 0, "G1 CBL spacers should be removed");
    assert(g1.insurerSpacers === 0, "G1 insurer spacers should be removed");
    assert(secondMove.noMatch.insurer.length === 0, "no insurer should be orphaned");
    assertNoCrossGroupPairing(secondMove.source);
  });

  test("adjacent group remains intact after moving previous group", () => {
    const firstMove = moveFromMatchedBucket(
      createFixtureBucket(),
      new Set(["PM-1"]),
      new Set(),
    );
    const remainingCblIds = groupRows(firstMove.source.cbl, "G1", false).map(
      (row) => row.idx,
    );
    const remainingInsurerIds = groupRows(
      firstMove.source.insurer,
      "G1",
      false,
    ).map((row) => row.idx);

    const secondMove = moveFromMatchedBucket(
      firstMove.source,
      new Set(remainingCblIds),
      new Set(remainingInsurerIds),
    );
    const g2 = counts(secondMove.source, "G2");

    assert(g2.realCbl === 1, "G2 CBL row should remain");
    assert(g2.realInsurer === 1, "G2 insurer row should remain");
    assert(g2.cblSpacers === 0, "G2 should not gain CBL spacers");
    assert(g2.insurerSpacers === 0, "G2 should not gain insurer spacers");
    assertNoCrossGroupPairing(secondMove.source);
  });

  test("exact to partial full group move clears source and builds matched destination", () => {
    const source = createFixtureBucket();
    const destination = { cbl: [], insurer: [] };
    const selectedCblIds = new Set(groupRows(source.cbl, "G1", false).map((row) => row.idx));
    const selectedInsurerIds = new Set(
      groupRows(source.insurer, "G1", false).map((row) => row.idx),
    );

    const result = applyMatchedToMatchedMove(
      source,
      destination,
      selectedCblIds,
      selectedInsurerIds,
      "EXACT-TO-PARTIAL-G1",
    );
    const sourceG1 = counts(result.source, "G1");
    const destG1 = counts(result.destination, "EXACT-TO-PARTIAL-G1");

    assert(sourceG1.realCbl === 0, "source G1 CBL rows should be moved");
    assert(sourceG1.realInsurer === 0, "source G1 insurer rows should be moved");
    assert(sourceG1.cblSpacers === 0, "source G1 CBL spacers should be removed");
    assert(destG1.realCbl === 3, "destination should receive 3 CBL rows");
    assert(destG1.realInsurer === 5, "destination should receive 5 insurer rows");
    assert(destG1.cblSpacers === 2, "destination should be equalized");
    assertNoCrossGroupPairing(result.source);
    assertNoCrossGroupPairing(result.destination);
  });

  test("matched to no-match full group cleans metadata and removes spacers", () => {
    const source = createFixtureBucket();
    const noMatch = { cbl: [], insurer: [] };
    const selectedCblIds = new Set(groupRows(source.cbl, "G1", false).map((row) => row.idx));
    const selectedInsurerIds = new Set(
      groupRows(source.insurer, "G1", false).map((row) => row.idx),
    );

    const result = applyMatchedToNoMatchMove(
      source,
      noMatch,
      selectedCblIds,
      selectedInsurerIds,
    );
    const sourceG1 = counts(result.source, "G1");

    assert(sourceG1.realCbl === 0, "source G1 CBL rows should be moved");
    assert(sourceG1.realInsurer === 0, "source G1 insurer rows should be moved");
    assert(result.noMatch.cbl.length === 3, "no-match should receive 3 CBL rows");
    assert(
      result.noMatch.insurer.length === 5,
      "no-match should receive 5 insurer rows",
    );
    assertNoMatchRowsAreClean(result.noMatch);
    assertNoCrossGroupPairing(result.source);
  });

  test("matched to no-match one-sided move sends orphaned counterpart rows", () => {
    const source = createFixtureBucket();
    const noMatch = { cbl: [], insurer: [] };
    const selectedCblIds = new Set(groupRows(source.cbl, "G1", false).map((row) => row.idx));

    const result = applyMatchedToNoMatchMove(
      source,
      noMatch,
      selectedCblIds,
      new Set(),
    );
    const sourceG1 = counts(result.source, "G1");

    assert(sourceG1.realCbl === 0, "all selected CBL rows should leave source");
    assert(
      sourceG1.realInsurer === 0,
      "insurer rows should leave source because they are orphaned",
    );
    assert(result.noMatch.cbl.length === 3, "selected CBL rows should move to no-match");
    assert(
      result.noMatch.insurer.length === 5,
      "orphaned insurer rows should move to no-match",
    );
    assertNoMatchRowsAreClean(result.noMatch);
    assertNoCrossGroupPairing(result.source);
  });

  test("no-match to exact with unequal counts adds matched spacers only in destination", () => {
    const source = createNoMatchFixture();
    const destination = { cbl: [], insurer: [] };
    const result = applyNoMatchToMatchedMove(
      source,
      destination,
      new Set(["NM-0", "NM-1"]),
      new Set(["NM-0", "NM-1", "NM-2"]),
      "NO-MATCH-TO-EXACT-G1",
    );
    const destG1 = counts(result.destination, "NO-MATCH-TO-EXACT-G1");

    assert(result.source.cbl.length === 1, "one no-match CBL row should remain");
    assert(result.source.insurer.length === 0, "no selected insurer rows should remain");
    assert(destG1.realCbl === 2, "destination should receive 2 CBL rows");
    assert(destG1.realInsurer === 3, "destination should receive 3 insurer rows");
    assert(destG1.cblSpacers === 1, "destination should add one CBL spacer");
    assertNoCrossGroupPairing(result.destination);
  });

  test("multi-group matched move only removes selected groups", () => {
    const source = createFixtureBucket();
    const selectedCblIds = new Set([
      ...groupRows(source.cbl, "G1", false).map((row) => row.idx),
      ...groupRows(source.cbl, "G2", false).map((row) => row.idx),
    ]);
    const selectedInsurerIds = new Set(groupRows(source.insurer, "G1", false).map((row) => row.idx));

    const result = moveFromMatchedBucket(source, selectedCblIds, selectedInsurerIds);
    const sourceG1 = counts(result.source, "G1");
    const sourceG2 = counts(result.source, "G2");

    assert(sourceG1.realCbl === 0, "G1 real CBL rows should move");
    assert(sourceG1.realInsurer === 0, "G1 insurer rows should move");
    assert(sourceG2.realCbl === 0, "G2 selected CBL row should move");
    assert(
      sourceG2.realInsurer === 0,
      "G2 insurer row should move to no-match as orphaned",
    );
    assert(result.noMatch.insurer.length === 1, "G2 orphan insurer should be no-match");
    assertNoCrossGroupPairing(result.source);
  });

  test("dynamic bucket style matched move follows same spacer invariants", () => {
    const dynamicBucket = createFixtureBucket();
    const result = moveFromMatchedBucket(
      dynamicBucket,
      new Set(["PM-0"]),
      new Set(),
    );
    const g1 = counts(result.source, "G1");

    assert(g1.realCbl === 2, "dynamic source should keep 2 real CBL rows");
    assert(g1.realInsurer === 5, "dynamic source should keep all insurer rows");
    assert(g1.cblSpacers === 3, "dynamic source should insert CBL spacer");
    assertNoCrossGroupPairing(result.source);
  });

  test("export-style counts ignore blank spacers and diff uses cbl plus insurer", () => {
    const bucket = createFixtureBucket();
    const merged = mergeData(bucket.cbl, bucket.insurer);
    const cblCount = countRowsWithAmount(merged, "ProcessedAmount");
    const insurerCount = countRowsWithAmount(merged, "ProcessedAmount_INSURER");
    const cblSum = sumRowsByAmount(merged, "ProcessedAmount");
    const insurerSum = sumRowsByAmount(merged, "ProcessedAmount_INSURER");

    assert(cblCount === 4, "export count should ignore CBL spacers");
    assert(insurerCount === 6, "export count should count non-blank insurer rows");
    assert(cblSum + insurerSum === 7, "diff should use CBL plus insurer totals");
  });

  let passed = 0;
  tests.forEach(({ name, fn }) => {
    try {
      fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      console.error(`  ${error.message}`);
    }
  });

  return { passed, failed: tests.length - passed };
}

function auditWorkbook() {
  const workbook = XLSX.readFile(workbookPath);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Partial Matches"], {
    defval: "",
  });
  const { cbl, insurer } = splitData(rows, "partial");
  const groups = new Map();

  cbl.forEach((row, index) => {
    const groupId = getGroupId(row) || getGroupId(insurer[index]);
    if (!groupId) return;
    if (!groups.has(groupId)) {
      groups.set(groupId, { cbl: [], insurer: [] });
    }
    groups.get(groupId).cbl.push(row);
    groups.get(groupId).insurer.push(insurer[index]);
  });

  const shapeCounts = new Map();
  groups.forEach((group) => {
    const key = `${group.cbl.filter((row) => !isBlankRow(row)).length} CBL / ${
      group.insurer.filter((row) => !isBlankRow(row)).length
    } insurer`;
    shapeCounts.set(key, (shapeCounts.get(key) || 0) + 1);
  });

  const interestingGroups = Array.from(groups.entries())
    .map(([groupId, group]) => ({
      groupId,
      cblCount: group.cbl.filter((row) => !isBlankRow(row)).length,
      insurerCount: group.insurer.filter((row) => !isBlankRow(row)).length,
      cblSpacers: group.cbl.filter(isBlankRow).length,
      insurerSpacers: group.insurer.filter(isBlankRow).length,
    }))
    .filter((group) => group.cblCount >= 2 && group.insurerCount >= 3)
    .slice(0, 8);

  console.log(`Workbook: ${workbookPath}`);
  console.log(`Partial Matches groups: ${groups.size}`);
  console.log("Common group shapes:");
  Array.from(shapeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([shape, count]) => console.log(`  ${shape}: ${count}`));

  if (interestingGroups.length > 0) {
    console.log("Groups suitable for move scenario reproduction:");
    interestingGroups.forEach((group) => {
      console.log(
        `  ${group.groupId}: ${group.cblCount} CBL / ${group.insurerCount} insurer, ` +
          `${group.cblSpacers} CBL spacers, ${group.insurerSpacers} insurer spacers`,
      );
    });
  }
}

function main() {
  auditWorkbook();
  console.log("");
  console.log("Running synthetic move scenario tests...");
  const result = runSyntheticMoveScenarios();
  console.log("");
  console.log(`Result: ${result.passed} passed, ${result.failed} failed`);

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main();
