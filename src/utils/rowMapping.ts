export function parseMatchedInsurerIndicesField(
  raw: unknown,
): unknown[] | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getRowGroupId(row: any): string | null {
  const raw = row?.group_id;
  if (raw == null) return null;

  const value = String(raw).trim();
  return value ? value : null;
}

export function getRowsWithSameGroupId(row: any, rows: any[]): any[] {
  const groupId = getRowGroupId(row);
  if (!groupId) return [];

  return rows.filter((candidate) => getRowGroupId(candidate) === groupId);
}

function parseBucketRowId(
  rowId: unknown,
): { prefix: string; index: number } | null {
  if (typeof rowId !== "string") {
    return null;
  }

  const match = rowId.match(/^(.*?)(\d+)$/);
  if (!match) {
    return null;
  }

  const index = parseInt(match[2], 10);
  if (isNaN(index)) {
    return null;
  }

  return {
    prefix: match[1],
    index,
  };
}

function buildBucketRowIdFromTemplate(
  templateRowId: string,
  index: number,
): string {
  const parsed = parseBucketRowId(templateRowId);
  return parsed ? `${parsed.prefix}${index}` : templateRowId;
}

export function getTargetInsurerRowIdsForCblRow(
  cblRow: any,
  allCblRowsInBucket: any[],
  allInsurerRowsInBucket?: any[],
): string[] {
  if (allInsurerRowsInBucket) {
    const groupRows = getRowsWithSameGroupId(cblRow, allInsurerRowsInBucket);
    if (groupRows.length > 0) {
      return groupRows
        .filter((row) => row?.idx && row?.ProcessedAmount !== "")
        .map((row) => row.idx);
    }
  }

  const matchedIndices = parseMatchedInsurerIndicesField(
    cblRow?.matched_insurer_indices,
  );
  if (!matchedIndices || matchedIndices.length === 0) {
    return [];
  }

  const currentRowId = parseBucketRowId(cblRow?.idx);
  if (!currentRowId) {
    return [];
  }

  const firstMatchingRowIndex = allCblRowsInBucket.findIndex(
    (row) => row.matched_insurer_indices === cblRow.matched_insurer_indices,
  );
  if (firstMatchingRowIndex === -1) {
    return [];
  }

  const baseRowId = parseBucketRowId(
    allCblRowsInBucket[firstMatchingRowIndex].idx,
  );
  if (!baseRowId) {
    return [];
  }

  return matchedIndices.map((_matchedIndex, offset) =>
    buildBucketRowIdFromTemplate(cblRow.idx, baseRowId.index + offset),
  );
}
