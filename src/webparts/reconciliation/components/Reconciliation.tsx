import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSpContext } from "../../../SpContext";
import "bootstrap/dist/css/bootstrap.min.css";
import { Button, useId, Toaster } from "@fluentui/react-components";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { fetchFile } from "../../../utils/fetchFiles";
import styles from "../components/Reconciliation.module.scss";
import { IListItemFormUpdateValue } from "@pnp/sp/lists";
import Header from "../../common/Header";
import { useTasks } from "../../../context/TaskContext";
import { useChanges } from "../../../context/ChangesContext";
import {
  useReconciliation,
  ActionHistoryItem,
} from "../../../context/ReconciliationContext";
import SummaryTable from "./SummaryTable";
import MatchableComponent from "./MatchableComponent";
import SaveChanges from "./SaveChanges";
import RemarksModal from "./RemarksModal";
import {
  addGroupAndCondition,
  calculateSum,
  clearSelectedRows,
  equalizeWorksheetLengths,
  filterOutSelectedRows,
  getNextMatchGroup,
  manualMatching,
  repairMatchedIndicesAfterUndo,
} from "../../../utils/utils";
import { generateMatrixKeys } from "../../../utils/generateMatrixKeys";
import { regenerateIdx } from "../../../utils/filterData";
import {
  getCanonicalCblFingerprint,
  getCanonicalInsurerFingerprint,
  MatchHistoryEntry,
  readMatchHistory,
} from "../../../utils/matchHistory";
import {
  BucketKey,
  BucketRows,
  isMatchedBucket,
} from "../../../utils/reconciliationBuckets";
import {
  getRowGroupId,
  getTargetInsurerRowIdsForCblRow,
  parseMatchedInsurerIndicesField,
} from "../../../utils/rowMapping";

/** Spacer / empty amount row — same idea as regroupRows `isBlankRow` + createBlankRow output */
function isBlankAmountRow(row: any): boolean {
  return (
    !row ||
    row.ProcessedAmount === undefined ||
    row.ProcessedAmount === null ||
    row.ProcessedAmount === ""
  );
}

/** Prefer stable row id so duplicate policy/amount pairs still resolve to the clicked row */
function findSideRowIndex(targetSide: any[], targetRow: any): number {
  const idx = targetRow?.idx;
  if (idx !== undefined && idx !== null && idx !== "") {
    const byIdx = targetSide.findIndex((r) => r.idx === idx);
    if (byIdx !== -1) return byIdx;
  }
  return targetSide.findIndex(
    (r) =>
      r.ProcessedPolicyNumber === targetRow.ProcessedPolicyNumber &&
      r.ProcessedAmount === targetRow.ProcessedAmount,
  );
}

/**
 * Parallel row index range [groupStart, groupEnd] for the regroup target block
 * (same rules as highlight: matched_insurer_indices + group_id, not match_group walks).
 */
function computeRegroupTargetParallelRange(
  cblArr: any[],
  insArr: any[],
  targetSide: "cbl" | "insurer",
  targetRow: any,
): { groupStart: number; groupEnd: number; targetIndex: number } | null {
  const sideArr = targetSide === "cbl" ? cblArr : insArr;
  const targetIndex = findSideRowIndex(sideArr, targetRow);
  if (targetIndex === -1) return null;

  const targetGroupId = getRowGroupId(targetRow);
  if (targetGroupId) {
    const groupPositions = [...cblArr, ...insArr]
      .map((row, index) => ({
        index: index < cblArr.length ? index : index - cblArr.length,
        matches: getRowGroupId(row) === targetGroupId,
      }))
      .filter((entry) => entry.matches)
      .map((entry) => entry.index);

    if (groupPositions.length > 0) {
      return {
        groupStart: Math.min(...groupPositions),
        groupEnd: Math.max(...groupPositions),
        targetIndex,
      };
    }
  }

  let anchorCblIndex: number;

  if (targetSide === "cbl") {
    anchorCblIndex = targetIndex;
  } else {
    anchorCblIndex = -1;
    for (let i = targetIndex; i >= 0; i--) {
      const cblRow = cblArr[i];
      if (isBlankAmountRow(cblRow)) continue;

      const indices = parseMatchedInsurerIndicesField(
        cblRow.matched_insurer_indices,
      );
      if (indices !== null && indices.length > 0) {
        if (i + indices.length - 1 >= targetIndex) {
          anchorCblIndex = i;
          break;
        }
      }
      const insTarget = insArr[targetIndex];
      if (
        cblRow.group_id &&
        insTarget?.group_id != null &&
        String(cblRow.group_id) === String(insTarget.group_id)
      ) {
        anchorCblIndex = i;
        break;
      }
    }
    if (anchorCblIndex === -1) {
      let fb = targetIndex;
      while (fb >= 0 && isBlankAmountRow(cblArr[fb])) fb--;
      anchorCblIndex = fb >= 0 ? fb : targetIndex;
    }
  }

  if (anchorCblIndex === -1 || anchorCblIndex >= cblArr.length) {
    return { groupStart: targetIndex, groupEnd: targetIndex, targetIndex };
  }

  const anchorRow = cblArr[anchorCblIndex];
  let groupSpan = 1;

  const anchorIndices = parseMatchedInsurerIndicesField(
    anchorRow?.matched_insurer_indices,
  );
  if (anchorIndices !== null && anchorIndices.length > 0) {
    groupSpan = anchorIndices.length;
  }

  const groupId = anchorRow?.group_id;
  let groupStartCbl = anchorCblIndex;
  let groupEndCbl = anchorCblIndex;

  if (groupId) {
    while (groupStartCbl > 0) {
      const prev = cblArr[groupStartCbl - 1];
      if (prev && prev.group_id === groupId && !isBlankAmountRow(prev)) {
        groupStartCbl--;
      } else {
        break;
      }
    }
    while (groupEndCbl + 1 < cblArr.length) {
      const next = cblArr[groupEndCbl + 1];
      if (next && next.group_id === groupId && !isBlankAmountRow(next)) {
        groupEndCbl++;
      } else {
        break;
      }
    }
    const cblRowCount = groupEndCbl - groupStartCbl + 1;
    groupSpan = Math.max(groupSpan, cblRowCount);
  }

  const groupStart = groupStartCbl;
  const groupEnd = groupStart + groupSpan - 1;
  return { groupStart, groupEnd, targetIndex };
}

/**
 * After regroup merge, each non-blank CBL row must own a contiguous parallel span
 * ending at the next CBL data row; offsets are [0..span-1] vs global row index.
 */
function repairParallelMatchedInsurerIndices(cblRows: any[]): any[] {
  const L = cblRows.length;
  return cblRows.map((row, r) => {
    if (isBlankAmountRow(row)) {
      const { matched_insurer_indices: _m, ...rest } = row;
      return rest;
    }
    let nextData = L;
    for (let t = r + 1; t < L; t++) {
      if (!isBlankAmountRow(cblRows[t])) {
        nextData = t;
        break;
      }
    }
    const span = Math.max(1, nextData - r);
    return {
      ...row,
      matched_insurer_indices: JSON.stringify(
        Array.from({ length: span }, (_, k) => k),
      ),
    };
  });
}

type BucketStateByKey = Record<string, BucketRows>;

function getRowsByFingerprints(
  rows: any[],
  fingerprints: string[] | undefined,
  getFingerprint: (row: any) => string,
): any[] {
  const fingerprintSet = new Set((fingerprints || []).filter(Boolean));
  if (fingerprintSet.size === 0) return [];
  return rows.filter((row) => fingerprintSet.has(getFingerprint(row)));
}

function removeRowsAndOppositeSpacers(
  bucketRows: BucketRows,
  cblFingerprints: string[] | undefined,
  insurerFingerprints: string[] | undefined,
): BucketRows {
  const cblFingerprintSet = new Set((cblFingerprints || []).filter(Boolean));
  const insurerFingerprintSet = new Set(
    (insurerFingerprints || []).filter(Boolean),
  );
  const cblPositionsToRemove = new Set<number>();
  const insurerPositionsToRemove = new Set<number>();

  bucketRows.cbl.forEach((row, index) => {
    if (cblFingerprintSet.has(getCanonicalCblFingerprint(row))) {
      cblPositionsToRemove.add(index);
    }
  });
  bucketRows.insurer.forEach((row, index) => {
    if (insurerFingerprintSet.has(getCanonicalInsurerFingerprint(row))) {
      insurerPositionsToRemove.add(index);
    }
  });

  cblPositionsToRemove.forEach((position) => {
    if (
      position < bucketRows.insurer.length &&
      isBlankAmountRow(bucketRows.insurer[position])
    ) {
      insurerPositionsToRemove.add(position);
    }
  });
  insurerPositionsToRemove.forEach((position) => {
    if (
      position < bucketRows.cbl.length &&
      isBlankAmountRow(bucketRows.cbl[position])
    ) {
      cblPositionsToRemove.add(position);
    }
  });

  return {
    cbl: bucketRows.cbl.filter((_, index) => !cblPositionsToRemove.has(index)),
    insurer: bucketRows.insurer.filter(
      (_, index) => !insurerPositionsToRemove.has(index),
    ),
  };
}

function applyRegroupMatchHistory(
  bucketState: BucketStateByKey,
  entries: MatchHistoryEntry[],
): BucketStateByKey {
  return entries
    .filter((entry) => entry.actionType === "regroup")
    .reduce<BucketStateByKey>((state, entry) => {
      const source = state[entry.fromBucket];
      const target = state[entry.targetBucket];
      if (!source || !target || entry.fromBucket === entry.targetBucket) {
        return state;
      }

      const targetCblRows = getRowsByFingerprints(
        target.cbl,
        entry.targetCblFingerprints,
        getCanonicalCblFingerprint,
      );
      const targetInsurerRows = getRowsByFingerprints(
        target.insurer,
        entry.targetInsurerFingerprints,
        getCanonicalInsurerFingerprint,
      );
      const movedCblRows = getRowsByFingerprints(
        source.cbl,
        entry.cblFingerprints,
        getCanonicalCblFingerprint,
      );
      const movedInsurerRows = getRowsByFingerprints(
        source.insurer,
        entry.insurerFingerprints,
        getCanonicalInsurerFingerprint,
      );

      if (
        targetCblRows.length + targetInsurerRows.length === 0 ||
        movedCblRows.length + movedInsurerRows.length === 0
      ) {
        return state;
      }

      const orphanedCblRows = getRowsByFingerprints(
        source.cbl,
        entry.orphanedCblFingerprints,
        getCanonicalCblFingerprint,
      );
      const orphanedInsurerRows = getRowsByFingerprints(
        source.insurer,
        entry.orphanedInsurerFingerprints,
        getCanonicalInsurerFingerprint,
      );

      const targetMatchGroup =
        targetCblRows[0]?.match_group ||
        targetInsurerRows[0]?.match_group ||
        movedCblRows[0]?.match_group ||
        movedInsurerRows[0]?.match_group ||
        1;
      const targetGroupId =
        targetCblRows[0]?.group_id ||
        targetInsurerRows[0]?.group_id ||
        movedCblRows[0]?.group_id ||
        movedInsurerRows[0]?.group_id;

      const nextSource = removeRowsAndOppositeSpacers(
        source,
        [...(entry.cblFingerprints || []), ...(entry.orphanedCblFingerprints || [])],
        [
          ...(entry.insurerFingerprints || []),
          ...(entry.orphanedInsurerFingerprints || []),
        ],
      );
      const nextTargetWithoutGroup = removeRowsAndOppositeSpacers(
        target,
        entry.targetCblFingerprints,
        entry.targetInsurerFingerprints,
      );

      let mergedCblRows = [
        ...targetCblRows.filter((row) => !isBlankAmountRow(row)),
        ...movedCblRows.filter((row) => !isBlankAmountRow(row)),
      ].map((row) => ({
        ...row,
        match_group: targetMatchGroup,
        match_condition: "manual match",
        group_id: targetGroupId || row.group_id,
        matched_insurer_indices: undefined,
      }));
      let mergedInsurerRows = [
        ...targetInsurerRows.filter((row) => !isBlankAmountRow(row)),
        ...movedInsurerRows.filter((row) => !isBlankAmountRow(row)),
      ].map((row) => ({
        ...row,
        match_group: targetMatchGroup,
        match_condition: "manual match",
        group_id: targetGroupId || row.group_id,
      }));

      if (
        isMatchedBucket(entry.targetBucket) &&
        mergedCblRows.length !== mergedInsurerRows.length
      ) {
        [mergedCblRows, mergedInsurerRows] = equalizeWorksheetLengths(
          mergedCblRows,
          mergedInsurerRows,
          targetMatchGroup,
        );
      }
      if (isMatchedBucket(entry.targetBucket)) {
        mergedCblRows = repairParallelMatchedInsurerIndices(mergedCblRows);
      }

      const nextNoMatch = state["no-match"] || { cbl: [], insurer: [] };
      const nextState = {
        ...state,
        [entry.fromBucket]: {
          cbl: isMatchedBucket(entry.fromBucket)
            ? repairParallelMatchedInsurerIndices(nextSource.cbl)
            : nextSource.cbl,
          insurer: nextSource.insurer,
        },
        [entry.targetBucket]: {
          cbl: [...nextTargetWithoutGroup.cbl, ...mergedCblRows],
          insurer: [...nextTargetWithoutGroup.insurer, ...mergedInsurerRows],
        },
      };

      if (orphanedCblRows.length > 0 || orphanedInsurerRows.length > 0) {
        nextState["no-match"] = {
          cbl: [
            ...nextNoMatch.cbl,
            ...orphanedCblRows.map((row) => ({
              ...row,
              match_group: undefined,
              match_condition: undefined,
              group_id: undefined,
              matched_insurer_indices: undefined,
            })),
          ],
          insurer: [
            ...nextNoMatch.insurer,
            ...orphanedInsurerRows.map((row) => ({
              ...row,
              match_group: undefined,
              match_condition: undefined,
              group_id: undefined,
            })),
          ],
        };
      }

      return nextState;
    }, bucketState);
}

function Reconciliation() {
  const { context, sp } = useSpContext();
  const [isLoading, setIsLoading] = useState(true);
  const { updateTaskStatus, tasks } = useTasks();
  const { setChanges } = useChanges();
  const {
    exactMatchCBL,
    setExactMatchCBL,
    exactMatchInsurer,
    setExactMatchInsurer,
    partialMatchCBL,
    setPartialMatchCBL,
    partialMatchInsurer,
    setPartialMatchInsurer,
    selectedRowCBL,
    setSelectedRowCBL,
    selectedRowInsurer,
    setSelectedRowInsurer,
    noMatchCBL,
    setNoMatchCBL,
    noMatchInsurer,
    setNoMatchInsurer,
    dynamicBuckets,
    setDynamicBuckets,
    dynamicBucketData,
    setDynamicBucketData,
    setPartialMatchSum1,
    setPartialMatchSum2,
    setNoMatchSum1,
    setNoMatchSum2,
    setExactMatchSum1,
    setExactMatchSum2,
    setCblColumns,
    setInsurerColumns,
    matrix,
    setMatrix,
    clearAllSelections,
    setClearAllSelections,
    addToHistory,
    actionHistory,
    removeFromHistory,
    addMatchHistoryEntry,
    regroupTarget,
    setRegroupTarget,
    clearRegroupTarget,
  } = useReconciliation();

  // Remarks modal state
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    toSection: BucketKey;
    actionType: "moveToExact" | "moveToPartial" | "unmatch" | "moveToBucket";
  } | null>(null);
  const [remarksMode, setRemarksMode] = useState<"move" | "standalone">("move");
  const [currentRemarks, setCurrentRemarks] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const insuranceName = urlParams.get("Insurance");
  const date = urlParams.get("Date");

  const getBucketRows = useCallback(
    (bucketKey: BucketKey): BucketRows => {
      switch (bucketKey) {
        case "exact":
          return { cbl: exactMatchCBL, insurer: exactMatchInsurer };
        case "partial":
          return { cbl: partialMatchCBL, insurer: partialMatchInsurer };
        case "no-match":
          return { cbl: noMatchCBL, insurer: noMatchInsurer };
        default:
          return dynamicBucketData[bucketKey] || { cbl: [], insurer: [] };
      }
    },
    [
      exactMatchCBL,
      exactMatchInsurer,
      partialMatchCBL,
      partialMatchInsurer,
      noMatchCBL,
      noMatchInsurer,
      dynamicBucketData,
    ],
  );

  const setBucketRows = useCallback(
    (bucketKey: BucketKey, side: "cbl" | "insurer", rows: any[]) => {
      switch (bucketKey) {
        case "exact":
          if (side === "cbl") {
            setExactMatchCBL(rows);
          } else {
            setExactMatchInsurer(rows);
          }
          return;
        case "partial":
          if (side === "cbl") {
            setPartialMatchCBL(rows);
          } else {
            setPartialMatchInsurer(rows);
          }
          return;
        case "no-match":
          if (side === "cbl") {
            setNoMatchCBL(rows);
          } else {
            setNoMatchInsurer(rows);
          }
          return;
        default:
          setDynamicBucketData((prev) => ({
            ...prev,
            [bucketKey]: {
              ...(prev[bucketKey] || { cbl: [], insurer: [] }),
              [side]: rows,
            },
          }));
      }
    },
    [
      setExactMatchCBL,
      setExactMatchInsurer,
      setPartialMatchCBL,
      setPartialMatchInsurer,
      setNoMatchCBL,
      setNoMatchInsurer,
      setDynamicBucketData,
    ],
  );

  const getAllBucketKeys = useCallback(
    (): BucketKey[] => [
      "exact",
      "partial",
      "no-match",
      ...dynamicBuckets.map((bucket) => bucket.BucketKey),
    ],
    [dynamicBuckets],
  );

  // Helper function to trigger clearing all selections
  const triggerClearAllSelections = useCallback(() => {
    setClearAllSelections(true);
    // Reset the trigger after a brief delay to allow components to react
    setTimeout(() => {
      setClearAllSelections(false);
    }, 100);
  }, [setClearAllSelections]);

  // Handle undo actions
  const handleUndoActions = useCallback(
    (actionIds: string[]) => {
      // Get the actions to undo (in reverse order - newest first)
      const actionsToUndo = actionHistory
        .filter((action) => actionIds.includes(action.id))
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

      if (actionsToUndo.length === 0) return;

      // Track cumulative changes
      const currentBucketData = getAllBucketKeys().reduce<
        Record<string, BucketRows>
      >((acc, bucketKey) => {
        const bucketRows = getBucketRows(bucketKey);
        acc[bucketKey] = {
          cbl: [...bucketRows.cbl],
          insurer: [...bucketRows.insurer],
        };
        return acc;
      }, {});

      const getCurrentBucketRows = (bucketKey: BucketKey): BucketRows => {
        if (!currentBucketData[bucketKey]) {
          currentBucketData[bucketKey] = { cbl: [], insurer: [] };
        }

        return currentBucketData[bucketKey];
      };

      // Process each action in reverse
      actionsToUndo.forEach((action) => {
        const {
          fromSection,
          toSection,
          cblRows,
          insurerRows,
          cblRowIndices,
          insurerRowIndices,
        } = action;

        // Helper to find and remove rows by matching key fields
        const removeRowsByMatch = (
          sourceArray: any[],
          rowsToRemove: any[],
        ): any[] => {
          return sourceArray.filter((sourceRow) => {
            // Check if any row in rowsToRemove matches this source row
            return !rowsToRemove.some((removeRow) => {
              // Match by ProcessedPolicyNumber and ProcessedAmount
              return (
                sourceRow.ProcessedPolicyNumber ===
                  removeRow.ProcessedPolicyNumber &&
                sourceRow.ProcessedAmount === removeRow.ProcessedAmount
              );
            });
          });
        };

        // Helper to insert rows at specific indices
        const insertRowsAtIndices = (
          targetArray: any[],
          rowsToInsert: any[],
          indices: number[],
        ): any[] => {
          const result = [...targetArray];

          // Pair each row with its original index
          const rowsWithIndices = rowsToInsert.map((row, i) => ({
            row,
            index: indices[i] !== undefined ? indices[i] : result.length + i,
          }));

          // Sort by index in ASCENDING order - this is critical!
          // When we insert at lower indices first, items shift right naturally
          // Example: restoring [b at 1, d at 3] to [a, c, e]
          // - Insert b at 1: [a, b, c, e] (c, e shifted right)
          // - Insert d at 3: [a, b, c, d, e] (e shifts to 4)
          rowsWithIndices.sort((a, b) => a.index - b.index);

          // Insert each row at its original position (NO offset needed!)
          // The splice operation naturally shifts subsequent items
          rowsWithIndices.forEach(({ row, index }) => {
            const insertIndex = Math.min(Math.max(0, index), result.length);
            result.splice(insertIndex, 0, row);
          });

          return result;
        };

        const destinationRows = getCurrentBucketRows(toSection);
        destinationRows.cbl = removeRowsByMatch(destinationRows.cbl, cblRows);
        destinationRows.insurer = removeRowsByMatch(
          destinationRows.insurer,
          insurerRows,
        );

        // Restore moved rows using original data if available (regroup stores original values)
        const cblRowsToRestore = action.originalCblData || cblRows;
        const insurerRowsToRestore = action.originalInsurerData || insurerRows;

        const sourceRows = getCurrentBucketRows(fromSection);
        sourceRows.cbl = insertRowsAtIndices(
          sourceRows.cbl,
          cblRowsToRestore,
          cblRowIndices || [],
        );
        sourceRows.insurer = insertRowsAtIndices(
          sourceRows.insurer,
          insurerRowsToRestore,
          insurerRowIndices || [],
        );

        // For regroup: also undo orphaned rows that were moved to no-match
        if (action.actionType === "regroup") {
          const {
            orphanedCblRows,
            orphanedInsurerRows,
            orphanedCblRowIndices,
            orphanedInsurerRowIndices,
          } = action;
          if (
            (orphanedCblRows && orphanedCblRows.length > 0) ||
            (orphanedInsurerRows && orphanedInsurerRows.length > 0)
          ) {
            // Remove orphaned rows from no-match
            const noMatchRows = getCurrentBucketRows("no-match");
            if (orphanedCblRows && orphanedCblRows.length > 0) {
              noMatchRows.cbl = removeRowsByMatch(
                noMatchRows.cbl,
                orphanedCblRows,
              );
            }
            if (orphanedInsurerRows && orphanedInsurerRows.length > 0) {
              noMatchRows.insurer = removeRowsByMatch(
                noMatchRows.insurer,
                orphanedInsurerRows,
              );
            }
            // Restore orphaned rows back to source
            if (orphanedCblRows && orphanedCblRows.length > 0) {
              sourceRows.cbl = insertRowsAtIndices(
                sourceRows.cbl,
                orphanedCblRows,
                orphanedCblRowIndices || [],
              );
            }
            if (orphanedInsurerRows && orphanedInsurerRows.length > 0) {
              sourceRows.insurer = insertRowsAtIndices(
                sourceRows.insurer,
                orphanedInsurerRows,
                orphanedInsurerRowIndices || [],
              );
            }
          }
        }
      });

      // Check if any undone action was a move from partial to exact
      // If so, we need to repair match_insurer_indices for the restored partial match rows
      const hasPartialToMatchedUndo = actionsToUndo.some(
        (action) =>
          action.fromSection === "partial" && isMatchedBucket(action.toSection),
      );

      const nextDynamicBucketData: Record<string, BucketRows> = {};

      getAllBucketKeys().forEach((bucketKey) => {
        const currentRows = getCurrentBucketRows(bucketKey);
        const regeneratedCBL = regenerateIdx(currentRows.cbl, bucketKey);
        const regeneratedInsurer = regenerateIdx(
          currentRows.insurer,
          bucketKey,
        );

        const finalCBL =
          bucketKey === "partial" && hasPartialToMatchedUndo
            ? repairMatchedIndicesAfterUndo(regeneratedCBL, regeneratedInsurer)
            : regeneratedCBL;

        if (
          bucketKey === "exact" ||
          bucketKey === "partial" ||
          bucketKey === "no-match"
        ) {
          setBucketRows(bucketKey, "cbl", finalCBL);
          setBucketRows(bucketKey, "insurer", regeneratedInsurer);
        } else {
          nextDynamicBucketData[bucketKey] = {
            cbl: finalCBL,
            insurer: regeneratedInsurer,
          };
        }
      });

      setDynamicBucketData(nextDynamicBucketData);

      // Remove the undone actions from history
      removeFromHistory(actionIds);

      // Mark changes (so save button becomes enabled)
      setChanges(true);

      // Clear selections
      triggerClearAllSelections();
    },
    [
      actionHistory,
      getAllBucketKeys,
      getBucketRows,
      setBucketRows,
      removeFromHistory,
      setChanges,
      setDynamicBucketData,
      triggerClearAllSelections,
    ],
  );

  const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/${insuranceName}/${date}/output.xlsx`;
  useEffect(() => {
    // Guard clause to ensure sp and required parameters are available
    if (!sp || !insuranceName || !date) {
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const fetchedFile = await fetchFile(url, sp);
        const {
          dynamicBuckets,
          columnNames,
        } = fetchedFile;

        let bucketState: BucketStateByKey = {
          exact: {
            cbl: fetchedFile.exactMatchCBL,
            insurer: fetchedFile.exactMatchInsurer,
          },
          partial: {
            cbl: fetchedFile.partialMatchCBL,
            insurer: fetchedFile.partialMatchInsurer,
          },
          "no-match": {
            cbl: fetchedFile.noMatchCBL,
            insurer: fetchedFile.noMatchInsurer,
          },
          ...fetchedFile.dynamicBucketData,
        };

        const persistedMatchHistory = await readMatchHistory(
          sp,
          insuranceName.toUpperCase().trim(),
          context.pageContext.web.serverRelativeUrl,
        );
        bucketState = applyRegroupMatchHistory(
          bucketState,
          persistedMatchHistory,
        );

        const exactMatchCBL = regenerateIdx(bucketState.exact.cbl, "exact");
        const exactMatchInsurer = regenerateIdx(
          bucketState.exact.insurer,
          "exact",
        );
        const partialMatchCBL = regenerateIdx(
          bucketState.partial.cbl,
          "partial",
        );
        const partialMatchInsurer = regenerateIdx(
          bucketState.partial.insurer,
          "partial",
        );
        const noMatchCBL = regenerateIdx(bucketState["no-match"].cbl, "no-match");
        const noMatchInsurer = regenerateIdx(
          bucketState["no-match"].insurer,
          "no-match",
        );
        const dynamicBucketData = dynamicBuckets.reduce<
          Record<string, BucketRows>
        >((acc, bucket) => {
          const rows = bucketState[bucket.BucketKey] || { cbl: [], insurer: [] };
          acc[bucket.BucketKey] = {
            cbl: regenerateIdx(rows.cbl, bucket.BucketKey),
            insurer: regenerateIdx(rows.insurer, bucket.BucketKey),
          };
          return acc;
        }, {});
        console.log("[Initial Render] Exact Match CBL:", exactMatchCBL);
        console.log("[Initial Render] Exact Match Insurer:", exactMatchInsurer);
        console.log("[Initial Render] Partial Match CBL:", partialMatchCBL);
        console.log(
          "[Initial Render] Partial Match Insurer:",
          partialMatchInsurer,
        );
        console.log("[Initial Render] No Match CBL:", noMatchCBL);
        console.log("[Initial Render] No Match Insurer:", noMatchInsurer);
        setExactMatchCBL(exactMatchCBL);
        setExactMatchInsurer(exactMatchInsurer);
        setPartialMatchCBL(partialMatchCBL);
        setPartialMatchInsurer(partialMatchInsurer);
        setNoMatchCBL(noMatchCBL);
        setNoMatchInsurer(noMatchInsurer);
        setDynamicBuckets(dynamicBuckets);
        setDynamicBucketData(dynamicBucketData);

        setCblColumns(columnNames.cbl);
        setInsurerColumns(columnNames.insurer);

        const { sum1, sum2 } = calculateSum(exactMatchCBL, exactMatchInsurer);
        setExactMatchSum1(sum1);
        setExactMatchSum2(sum2);

        const { sum1: partialMatchSum1, sum2: partialMatchSum2 } = calculateSum(
          partialMatchCBL,
          partialMatchInsurer,
        );
        setPartialMatchSum1(partialMatchSum1);
        setPartialMatchSum2(partialMatchSum2);

        const { sum1: noMatchSum1, sum2: noMatchSum2 } = calculateSum(
          noMatchCBL,
          noMatchInsurer,
        );
        setNoMatchSum1(noMatchSum1);
        setNoMatchSum2(noMatchSum2);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchColumnMappings = async () => {
      try {
        const columnMappings = await sp.web.lists.getByTitle("Mappings");

        const [{ ColumnMappings: cbl }]: [{ ColumnMappings: string }] =
          await columnMappings.items.filter(`Title eq 'CBL'`)();

        const [{ ColumnMappings: insuranceColumnMappings }]: [
          { ColumnMappings: string },
        ] = await columnMappings.items.filter(
          `Title eq '${insuranceName?.toUpperCase()}'`,
        )();
      } catch (error) {
        console.error("Failed to fetch column mappings:", error);
      }
    };

    fetchData();
    fetchColumnMappings();
  }, [sp, insuranceName, date, url, setDynamicBucketData, setDynamicBuckets]);

  useEffect(() => {
    const { sum1, sum2 } = calculateSum(exactMatchCBL, exactMatchInsurer);
    setExactMatchSum1(sum1);
    setExactMatchSum2(sum2);

    const { sum1: partialMatchSum1, sum2: partialMatchSum2 } = calculateSum(
      partialMatchCBL,
      partialMatchInsurer,
    );
    setPartialMatchSum1(partialMatchSum1);
    setPartialMatchSum2(partialMatchSum2);

    const { sum1: noMatchSum1, sum2: noMatchSum2 } = calculateSum(
      noMatchCBL,
      noMatchInsurer,
    );
    setNoMatchSum1(noMatchSum1);
    setNoMatchSum2(noMatchSum2);
  }, [
    exactMatchCBL,
    exactMatchInsurer,
    partialMatchCBL,
    partialMatchInsurer,
    noMatchCBL,
    noMatchInsurer,
  ]);

  // Unified function to move rows between sections
  const moveRows = useCallback(
    async (
      toSection: BucketKey,
      actionType: "moveToExact" | "moveToPartial" | "unmatch" | "moveToBucket",
      remarks?: string,
    ) => {
      if (selectedRowCBL.length === 0 || selectedRowInsurer.length === 0) {
        return;
      }

      setChanges(true);
      const matrixKey = generateMatrixKeys(selectedRowCBL, selectedRowInsurer);
      setMatrix((prev) => [...prev, matrixKey]);

      // Determine source section
      const findSourceSection = (): BucketKey | null =>
        getAllBucketKeys().find((bucketKey) =>
          getBucketRows(bucketKey).cbl.some((row) =>
            selectedRowCBL.some((selected) => selected.idx === row.idx),
          ),
        ) || null;

      const fromSection = findSourceSection();
      if (!fromSection) {
        console.warn("Could not determine source section");
        return;
      }

      const source = getBucketRows(fromSection);
      const destination = getBucketRows(toSection);

      // Helper to check if a row is blank
      const isBlankRow = (row: any): boolean => {
        return !row.ProcessedAmount || row.ProcessedAmount === "";
      };

      // Helper to check if a row is selected
      const isRowSelected = (row: any, selectedRows: any[]): boolean => {
        return selectedRows.some((selected) => selected.idx === row.idx);
      };

      // Helper to find the range of indices to move (including blank rows for equalization)
      const findEqualizedRange = (
        sourceArray: any[],
        selectedIndices: number[],
      ): number[] => {
        if (selectedIndices.length === 0) return [];

        const minIndex = Math.min(...selectedIndices);
        const maxIndex = Math.max(...selectedIndices);

        // For equalized tables (exact/partial), include all rows in the range
        // This includes blank rows that were added for equalization
        const range: number[] = [];
        for (let i = minIndex; i <= maxIndex; i++) {
          if (i < sourceArray.length) {
            range.push(i);
          }
        }
        return range;
      };

      // Remove from source (special handling for exact match with one-to-many)
      let updatedSourceCBL: any[];
      let updatedSourceInsurer: any[];
      let rowsToMoveCBL: any[];
      let rowsToMoveInsurer: any[];
      let cblRowIndices: number[] = [];
      let insurerRowIndices: number[] = [];

      if (fromSection === "exact") {
        // For exact matches, only remove rows that are actually selected
        // Build sets of selected row indices for quick lookup
        const selectedCBLIndices = new Set(
          selectedRowCBL.map((row) => row.idx),
        );
        const selectedInsurerIndices = new Set(
          selectedRowInsurer.map((row) => row.idx),
        );

        // Find CBL rows to remove - ONLY rows that are actually selected
        const rowsToRemoveCBL = new Set<number>();
        selectedRowCBL.forEach((selectedRow: any) => {
          const selectedIndex = source.cbl.findIndex(
            (row) => row.idx === selectedRow.idx,
          );
          if (selectedIndex !== -1) {
            rowsToRemoveCBL.add(selectedIndex);
          }
        });

        // For insurer rows, only remove rows that are actually selected
        // Handle one-to-many relationships: if a selected CBL row has multiple matches,
        // only remove the corresponding insurer rows that are also selected
        const rowsToRemoveInsurer = new Set<number>();

        selectedRowCBL.forEach((selectedCBLRow: any) => {
          const cblIndex = source.cbl.findIndex(
            (row) => row.idx === selectedCBLRow.idx,
          );

          if (cblIndex !== -1) {
            const cblRow = source.cbl[cblIndex];

            if (cblRow.matched_insurer_indices) {
              try {
                const matchedIndices = JSON.parse(
                  cblRow.matched_insurer_indices,
                );
                if (
                  Array.isArray(matchedIndices) &&
                  matchedIndices.length > 1
                ) {
                  // One-to-many: check each corresponding insurer row and only remove if selected
                  for (let i = 0; i < matchedIndices.length; i++) {
                    const insurerIndex = cblIndex + i;
                    if (insurerIndex < source.insurer.length) {
                      const insurerRow = source.insurer[insurerIndex];
                      // CRITICAL FIX: Only remove if this insurer row is actually selected
                      if (selectedInsurerIndices.has(insurerRow.idx)) {
                        rowsToRemoveInsurer.add(insurerIndex);
                      }
                    }
                  }
                } else {
                  // Single match: only remove if the insurer row is selected
                  if (cblIndex < source.insurer.length) {
                    const insurerRow = source.insurer[cblIndex];
                    if (selectedInsurerIndices.has(insurerRow.idx)) {
                      rowsToRemoveInsurer.add(cblIndex);
                    }
                  }
                }
              } catch (error) {
                console.warn("Failed to parse matched_insurer_indices:", error);
                // Fallback: only remove if insurer row is selected
                if (cblIndex < source.insurer.length) {
                  const insurerRow = source.insurer[cblIndex];
                  if (selectedInsurerIndices.has(insurerRow.idx)) {
                    rowsToRemoveInsurer.add(cblIndex);
                  }
                }
              }
            } else {
              // No matched_insurer_indices: only remove if insurer row is selected
              if (cblIndex < source.insurer.length) {
                const insurerRow = source.insurer[cblIndex];
                if (selectedInsurerIndices.has(insurerRow.idx)) {
                  rowsToRemoveInsurer.add(cblIndex);
                }
              }
            }
          }
        });

        // Also add directly selected insurer rows
        selectedRowInsurer.forEach((selectedRow: any) => {
          const selectedIndex = source.insurer.findIndex(
            (row) => row.idx === selectedRow.idx,
          );
          if (selectedIndex !== -1) {
            rowsToRemoveInsurer.add(selectedIndex);
          }
        });

        // Remove selected rows plus their same-position opposite spacer only.
        // A broad min..max range is unsafe for regrouped exact buckets because
        // group-selected real rows can span blank spacers without meaning that
        // neighboring groups' spacers should be removed.
        const finalRowsToRemoveCBL = new Set(rowsToRemoveCBL);
        const finalRowsToRemoveInsurer = new Set(rowsToRemoveInsurer);

        rowsToRemoveCBL.forEach((position) => {
          if (
            position < source.insurer.length &&
            isBlankRow(source.insurer[position])
          ) {
            finalRowsToRemoveInsurer.add(position);
          }
        });
        rowsToRemoveInsurer.forEach((position) => {
          if (position < source.cbl.length && isBlankRow(source.cbl[position])) {
            finalRowsToRemoveCBL.add(position);
          }
        });

        // Filter out rows to remove
        updatedSourceCBL = source.cbl.filter(
          (_, index) => !finalRowsToRemoveCBL.has(index),
        );
        updatedSourceInsurer = source.insurer.filter(
          (_, index) => !finalRowsToRemoveInsurer.has(index),
        );

        // Get rows to move - includes blank rows that were part of equalization
        rowsToMoveCBL = source.cbl.filter((_, index) => {
          if (!finalRowsToRemoveCBL.has(index)) {
            return false;
          }
          cblRowIndices.push(index);
          return true;
        });
        rowsToMoveInsurer = source.insurer.filter((_, index) => {
          if (!finalRowsToRemoveInsurer.has(index)) {
            return false;
          }
          insurerRowIndices.push(index);
          return true;
        });
      } else {
        // For partial and no-match, find indices of selected rows
        const selectedCBLIndices: number[] = [];
        const selectedInsurerIndices: number[] = [];

        selectedRowCBL.forEach((selectedRow) => {
          const index = source.cbl.findIndex(
            (row) => row.idx === selectedRow.idx,
          );
          if (index !== -1) selectedCBLIndices.push(index);
        });

        selectedRowInsurer.forEach((selectedRow) => {
          const index = source.insurer.findIndex(
            (row) => row.idx === selectedRow.idx,
          );
          if (index !== -1) selectedInsurerIndices.push(index);
        });

        // For equalized tables (partial), find the range including blank rows
        let cblRangeToMove: number[] = [];
        let insurerRangeToMove: number[] = [];

        if (fromSection === "partial") {
          // For partial matches, include blank rows in the equalized range
          const cblBaseRange = findEqualizedRange(
            source.cbl,
            selectedCBLIndices,
          );
          const insurerBaseRange = findEqualizedRange(
            source.insurer,
            selectedInsurerIndices,
          );

          // Determine target length (the longer range, as tables are equalized)
          const targetLength = Math.max(
            cblBaseRange.length,
            insurerBaseRange.length,
          );

          // Extend CBL range to match target length
          cblRangeToMove = [...cblBaseRange];
          let cblMaxIndex =
            cblBaseRange.length > 0 ? Math.max(...cblBaseRange) : -1;
          while (
            cblRangeToMove.length < targetLength &&
            cblMaxIndex + 1 < source.cbl.length
          ) {
            cblMaxIndex++;
            if (
              isBlankRow(source.cbl[cblMaxIndex]) ||
              cblRangeToMove.length < targetLength
            ) {
              cblRangeToMove.push(cblMaxIndex);
            }
          }

          // Extend insurer range to match target length
          insurerRangeToMove = [...insurerBaseRange];
          let insurerMaxIndex =
            insurerBaseRange.length > 0 ? Math.max(...insurerBaseRange) : -1;
          while (
            insurerRangeToMove.length < targetLength &&
            insurerMaxIndex + 1 < source.insurer.length
          ) {
            insurerMaxIndex++;
            if (
              isBlankRow(source.insurer[insurerMaxIndex]) ||
              insurerRangeToMove.length < targetLength
            ) {
              insurerRangeToMove.push(insurerMaxIndex);
            }
          }

          // Final check: ensure both ranges are exactly the same length
          const finalLength = Math.max(
            cblRangeToMove.length,
            insurerRangeToMove.length,
          );
          while (
            cblRangeToMove.length < finalLength &&
            cblMaxIndex + 1 < source.cbl.length
          ) {
            cblMaxIndex++;
            cblRangeToMove.push(cblMaxIndex);
          }
          while (
            insurerRangeToMove.length < finalLength &&
            insurerMaxIndex + 1 < source.insurer.length
          ) {
            insurerMaxIndex++;
            insurerRangeToMove.push(insurerMaxIndex);
          }
        } else {
          // For no-match, just use selected indices (no equalization needed)
          cblRangeToMove = selectedCBLIndices;
          insurerRangeToMove = selectedInsurerIndices;
        }

        // Remove rows in the range
        const cblIndicesToRemove = new Set(cblRangeToMove);
        const insurerIndicesToRemove = new Set(insurerRangeToMove);

        updatedSourceCBL = source.cbl.filter(
          (_, index) => !cblIndicesToRemove.has(index),
        );
        updatedSourceInsurer = source.insurer.filter(
          (_, index) => !insurerIndicesToRemove.has(index),
        );

        // Get rows to move - includes blank rows for partial matches
        rowsToMoveCBL = source.cbl.filter((_, index) => {
          if (!cblIndicesToRemove.has(index)) {
            return false;
          }
          cblRowIndices.push(index);
          return true;
        });
        rowsToMoveInsurer = source.insurer.filter((_, index) => {
          if (!insurerIndicesToRemove.has(index)) {
            return false;
          }
          insurerRowIndices.push(index);
          return true;
        });
      }

      // Apply remarks to rows before recording history
      if (remarks?.trim()) {
        rowsToMoveCBL = rowsToMoveCBL.map((row) => ({
          ...row,
          Remarks: remarks,
        }));
        rowsToMoveInsurer = rowsToMoveInsurer.map((row) => ({
          ...row,
          Remarks: remarks,
        }));
      }

      // Add to history (use full rowsToMove snapshot, including blank rows)
      addToHistory({
        actionType,
        fromSection,
        toSection,
        cblRows: rowsToMoveCBL,
        insurerRows: rowsToMoveInsurer,
        cblRowIndices,
        insurerRowIndices,
        matrixKey,
      });

      // Record match history for cross-session persistence
      const nonBlankCBL = rowsToMoveCBL.filter(
        (row) =>
          row.ProcessedAmount !== undefined && row.ProcessedAmount !== "",
      );
      const nonBlankInsurer = rowsToMoveInsurer.filter(
        (row) =>
          row.ProcessedAmount !== undefined && row.ProcessedAmount !== "",
      );

      if (nonBlankCBL.length > 0 || nonBlankInsurer.length > 0) {
        const cblFingerprintsWithRows = nonBlankCBL.filter((row) =>
          getCanonicalCblFingerprint(row),
        );
        const insurerFingerprintsWithRows = nonBlankInsurer.filter((row) =>
          getCanonicalInsurerFingerprint(row),
        );

        const historyEntry: MatchHistoryEntry = {
          cblFingerprints: cblFingerprintsWithRows.map((row) =>
            getCanonicalCblFingerprint(row),
          ),
          insurerFingerprints: insurerFingerprintsWithRows.map((row) =>
            getCanonicalInsurerFingerprint(row),
          ),
          cblRemarks: cblFingerprintsWithRows.map((row) => row.Remarks || ""),
          insurerRemarks: insurerFingerprintsWithRows.map(
            (row) => row.Remarks || "",
          ),
          targetBucket: toSection,
          fromBucket: fromSection,
          timestamp: new Date().toISOString(),
        };
        addMatchHistoryEntry(historyEntry);
      }

      // Handle special case: partial to matched buckets (uses manualMatching)
      if (fromSection === "partial" && isMatchedBucket(toSection)) {
        // Calculate deselected rows by comparing full group context vs selected rows
        const allCBLRowsInSelectedGroups = new Set<string>();
        const allInsurerRowsInSelectedGroups = new Set<string>();

        // First, collect all unique group_ids from selected rows
        const selectedGroupIds = new Set<string>();
        selectedRowCBL.forEach((selectedCBLRow) => {
          if (selectedCBLRow.group_id) {
            selectedGroupIds.add(selectedCBLRow.group_id);
          }
        });

        // Now get ALL CBL rows in those groups (including deselected ones)
        partialMatchCBL.forEach((row) => {
          if (row.group_id && selectedGroupIds.has(row.group_id)) {
            allCBLRowsInSelectedGroups.add(row.idx);
          }
        });

        // Get corresponding insurer rows from matched_insurer_indices for ALL rows in selected groups
        partialMatchCBL.forEach((cblRow) => {
          if (cblRow.group_id && selectedGroupIds.has(cblRow.group_id)) {
            const targetIdxs = getTargetInsurerRowIdsForCblRow(
              cblRow,
              partialMatchCBL,
            );
            targetIdxs.forEach((idx) => {
              if (partialMatchInsurer.some((row) => row.idx === idx)) {
                allInsurerRowsInSelectedGroups.add(idx);
              }
            });
          }
        });

        // Calculate deselected rows (rows in selected groups but not in selectedRowCBL)
        const deselectedCBLRows = Array.from(allCBLRowsInSelectedGroups).filter(
          (idx) => !selectedRowCBL.some((selected) => selected.idx === idx),
        );

        // For insurer, deselected rows are any rows in selected groups
        // that are not currently selected (manual deselections).
        const deselectedInsurerRows = Array.from(
          allInsurerRowsInSelectedGroups,
        ).filter(
          (idx) => !selectedRowInsurer.some((selected) => selected.idx === idx),
        );

        // Remove duplicates
        const uniqueDeselectedInsurerRows = Array.from(
          new Set(deselectedInsurerRows),
        );

        const deselectedCBLRowObjects = deselectedCBLRows
          .map((idx) => partialMatchCBL.find((row) => row.idx === idx))
          .filter(Boolean);
        const deselectedInsurerRowObjects = uniqueDeselectedInsurerRows
          .map((idx) => partialMatchInsurer.find((row) => row.idx === idx))
          .filter(Boolean);

        console.log("[Selection] Selected CBL rows (objects):", selectedRowCBL);
        console.log(
          "[Selection] Selected Insurer rows (objects):",
          selectedRowInsurer,
        );
        console.log(
          "[Selection] Deselected CBL rows (objects):",
          deselectedCBLRowObjects,
        );
        console.log(
          "[Selection] Deselected Insurer rows (objects):",
          deselectedInsurerRowObjects,
        );

        const {
          updatedRowsCBL,
          updatedRowsInsurer,
          exactMatchCBLRows,
          exactMatchInsurerRows,
          updatedNoMatchInsurer,
          updatedNoMatchCBL,
        } = manualMatching(
          partialMatchCBL,
          partialMatchInsurer,
          selectedRowCBL,
          selectedRowInsurer,
          noMatchInsurer,
          noMatchCBL,
          deselectedCBLRows,
          uniqueDeselectedInsurerRows,
          Array.from(allCBLRowsInSelectedGroups),
          Array.from(allInsurerRowsInSelectedGroups),
        );

        // Remove blank rows that belonged to the moved groups, then re-equalize for remaining groups
        // Key insight: equalizeWorksheetLengths adds blank rows at the END of shorter arrays
        // So blank rows for a group appear consecutively after the group's data rows

        // Step 1: Find original positions and range of moved rows
        const findMovedRange = (selectedRows: any[], sourceArray: any[]) => {
          const indices: number[] = [];
          selectedRows.forEach((selectedRow) => {
            const index = sourceArray.findIndex(
              (row) => row.idx === selectedRow.idx,
            );
            if (index !== -1) indices.push(index);
          });
          if (indices.length === 0) return { min: -1, max: -1 };
          return { min: Math.min(...indices), max: Math.max(...indices) };
        };

        const allGroupCBLRowRefs = Array.from(allCBLRowsInSelectedGroups).map(
          (idx) => ({ idx }),
        );
        const allGroupInsurerRowRefs = Array.from(
          allInsurerRowsInSelectedGroups,
        ).map((idx) => ({ idx }));

        const cblRange = findMovedRange(allGroupCBLRowRefs, partialMatchCBL);
        const insurerRange = findMovedRange(
          allGroupInsurerRowRefs,
          partialMatchInsurer,
        );

        // Step 2: Extend range to include trailing blank rows (added for equalization)
        // Helper: extend range to include consecutive blank rows immediately following
        const extendRangeToIncludeTrailingBlanks = (
          maxIndex: number,
          sourceArray: any[],
        ): number => {
          let extendedMax = maxIndex;
          for (let i = maxIndex + 1; i < sourceArray.length; i++) {
            if (isBlankRow(sourceArray[i])) {
              extendedMax = i; // Include this consecutive blank row
            } else {
              break; // Hit non-blank row - stop extending
            }
          }
          return extendedMax;
        };

        const extendedMaxCBL = extendRangeToIncludeTrailingBlanks(
          cblRange.max,
          partialMatchCBL,
        );
        const extendedMaxInsurer = extendRangeToIncludeTrailingBlanks(
          insurerRange.max,
          partialMatchInsurer,
        );

        // Step 3: Identify blank rows in extended range to remove
        const collectBlankRowsInRange = (
          sourceArray: any[],
          minIndex: number,
          maxIndex: number,
        ): Set<string> => {
          const blankRowIds = new Set<string>();
          for (let i = minIndex; i <= maxIndex; i++) {
            if (i < sourceArray.length && isBlankRow(sourceArray[i])) {
              blankRowIds.add(sourceArray[i].idx);
            }
          }
          return blankRowIds;
        };

        const blankRowsToRemoveCBL = collectBlankRowsInRange(
          partialMatchCBL,
          cblRange.min,
          extendedMaxCBL,
        );
        const blankRowsToRemoveInsurer = collectBlankRowsInRange(
          partialMatchInsurer,
          insurerRange.min,
          extendedMaxInsurer,
        );

        // Step 4: Remove identified blank rows from updated arrays
        const cleanedCBL = updatedRowsCBL.filter(
          (row) => !isBlankRow(row) || !blankRowsToRemoveCBL.has(row.idx),
        );
        const cleanedInsurer = updatedRowsInsurer.filter(
          (row) => !isBlankRow(row) || !blankRowsToRemoveInsurer.has(row.idx),
        );

        // Step 5: Re-equalize with cleaned arrays (this will add blank rows for remaining groups - the "green" ones)
        const nonBlankCBL = cleanedCBL.filter((row) => !isBlankRow(row));
        const nonBlankInsurer = cleanedInsurer.filter(
          (row) => !isBlankRow(row),
        );
        const currentPartialMatchGroup = getNextMatchGroup(
          nonBlankCBL,
          nonBlankInsurer,
        );

        // Re-equalize - this will add blank rows only for remaining groups
        const [equalizedSourceCBL, equalizedSourceInsurer] =
          equalizeWorksheetLengths(
            cleanedCBL,
            cleanedInsurer,
            currentPartialMatchGroup,
          );

        const regeneratedPartialCBL = regenerateIdx(
          equalizedSourceCBL,
          "partial",
        );
        const regeneratedPartialInsurer = regenerateIdx(
          equalizedSourceInsurer,
          "partial",
        );
        const regeneratedNoMatchInsurer = regenerateIdx(
          updatedNoMatchInsurer,
          "no-match",
        );

        // Handle orphaned CBL rows
        if (updatedNoMatchCBL) {
          setNoMatchCBL(regenerateIdx(updatedNoMatchCBL, "no-match"));
        }

        setPartialMatchCBL(regeneratedPartialCBL);
        setPartialMatchInsurer(regeneratedPartialInsurer);
        setNoMatchInsurer(regeneratedNoMatchInsurer);

        // Add selected rows to the destination matched bucket
        const nextMatchGroup = getNextMatchGroup(
          destination.cbl,
          destination.insurer,
        );

        // Apply remarks to partial-to-matched rows
        const remarkedCBLRows = remarks?.trim()
          ? exactMatchCBLRows.map((row) => ({ ...row, Remarks: remarks }))
          : exactMatchCBLRows;
        const remarkedInsurerRows = remarks?.trim()
          ? exactMatchInsurerRows.map((row) => ({ ...row, Remarks: remarks }))
          : exactMatchInsurerRows;

        const exactMatchRowsWithGroupCBL = addGroupAndCondition(
          remarkedCBLRows,
          nextMatchGroup,
        );
        const exactMatchRowsWithGroupInsurer = addGroupAndCondition(
          remarkedInsurerRows,
          nextMatchGroup,
        );

        const newMatchedBucketCBL = [
          ...destination.cbl,
          ...exactMatchRowsWithGroupCBL,
        ];
        const newMatchedBucketInsurer = [
          ...destination.insurer,
          ...exactMatchRowsWithGroupInsurer,
        ];

        const [equalizedDestinationCBL, equalizedDestinationInsurer] =
          equalizeWorksheetLengths(
            newMatchedBucketCBL,
            newMatchedBucketInsurer,
            nextMatchGroup,
          );

        console.log(
          `[Move] Updated ${toSection} CBL:`,
          equalizedDestinationCBL,
        );
        console.log(
          `[Move] Updated ${toSection} Insurer:`,
          equalizedDestinationInsurer,
        );

        setBucketRows(
          toSection,
          "cbl",
          regenerateIdx(equalizedDestinationCBL, toSection),
        );
        setBucketRows(
          toSection,
          "insurer",
          regenerateIdx(equalizedDestinationInsurer, toSection),
        );

        setSelectedRowCBL([]);
        setSelectedRowInsurer([]);
        triggerClearAllSelections();
        return;
      } else {
        // Preserve existing spacer rows in matched buckets. Removing all blanks
        // here destroys unrelated groups after moving a regrouped block.
        let finalSourceCBL = updatedSourceCBL;
        const finalSourceInsurer = updatedSourceInsurer;

        if (isMatchedBucket(fromSection)) {
          finalSourceCBL = repairParallelMatchedInsurerIndices(finalSourceCBL);
        }

        // Regenerate source indices
        const regeneratedSourceCBL = regenerateIdx(finalSourceCBL, fromSection);
        const regeneratedSourceInsurer = regenerateIdx(
          finalSourceInsurer,
          fromSection,
        );

        setBucketRows(fromSection, "cbl", regeneratedSourceCBL);
        setBucketRows(fromSection, "insurer", regeneratedSourceInsurer);
      }

      // Add to destination. Keep existing matched-bucket spacers intact; they
      // belong to already-rendered groups and should not be globally stripped.
      const destinationCBLBase = isMatchedBucket(toSection)
        ? destination.cbl
        : destination.cbl.filter((row) => !isBlankRow(row));
      const destinationInsurerBase = isMatchedBucket(toSection)
        ? destination.insurer
        : destination.insurer.filter((row) => !isBlankRow(row));

      const nextMatchGroup = getNextMatchGroup(
        destinationCBLBase,
        destinationInsurerBase,
      );

      const cblRowsToAdd = isMatchedBucket(toSection)
        ? rowsToMoveCBL
        : rowsToMoveCBL.filter((row) => !isBlankRow(row));
      const insurerRowsToAdd = isMatchedBucket(toSection)
        ? rowsToMoveInsurer
        : rowsToMoveInsurer.filter((row) => !isBlankRow(row));

      const rowsWithGroupCBL = addGroupAndCondition(
        cblRowsToAdd,
        nextMatchGroup,
      );
      const rowsWithGroupInsurer = addGroupAndCondition(
        insurerRowsToAdd,
        nextMatchGroup,
      );

      // Add new rows to cleaned destination
      // Note: We don't re-equalize at destination since we're moving an already-equalized group
      let newDestinationCBL = [
        ...destinationCBLBase,
        ...rowsWithGroupCBL,
      ];
      let newDestinationInsurer = [
        ...destinationInsurerBase,
        ...rowsWithGroupInsurer,
      ];

      if (isMatchedBucket(toSection)) {
        newDestinationCBL =
          repairParallelMatchedInsurerIndices(newDestinationCBL);
      }

      // Regenerate destination indices
      const regeneratedDestinationCBL = regenerateIdx(
        newDestinationCBL,
        toSection,
      );
      const regeneratedDestinationInsurer = regenerateIdx(
        newDestinationInsurer,
        toSection,
      );

      setBucketRows(toSection, "cbl", regeneratedDestinationCBL);
      setBucketRows(toSection, "insurer", regeneratedDestinationInsurer);

      // Clear selections
      setSelectedRowCBL([]);
      setSelectedRowInsurer([]);
      triggerClearAllSelections();
    },
    [
      selectedRowCBL,
      selectedRowInsurer,
      exactMatchCBL,
      exactMatchInsurer,
      partialMatchCBL,
      partialMatchInsurer,
      noMatchCBL,
      noMatchInsurer,
      getAllBucketKeys,
      getBucketRows,
      setBucketRows,
      setChanges,
      addToHistory,
      addMatchHistoryEntry,
      triggerClearAllSelections,
      setMatrix,
      setSelectedRowCBL,
      setSelectedRowInsurer,
    ],
  );

  const handleMoveToPartialMatch = () => {
    setPendingAction({ toSection: "partial", actionType: "moveToPartial" });
    setRemarksMode("move");
    setCurrentRemarks(
      selectedRowCBL[0]?.Remarks || selectedRowInsurer[0]?.Remarks || "",
    );
    setShowRemarksModal(true);
  };

  const handleUnmatch = () => {
    setPendingAction({ toSection: "no-match", actionType: "unmatch" });
    setRemarksMode("move");
    setCurrentRemarks(
      selectedRowCBL[0]?.Remarks || selectedRowInsurer[0]?.Remarks || "",
    );
    setShowRemarksModal(true);
  };

  // Legacy code below - keeping for reference but should be removed
  const _handleUnmatch_OLD = async () => {
    if (selectedRowCBL.length > 0 && selectedRowInsurer.length > 0) {
      setChanges(true);

      const matrixKey = generateMatrixKeys(selectedRowCBL, selectedRowInsurer);

      setMatrix([...matrix, matrixKey]);

      // Check if selected rows are from exact match section
      const isFromExactMatch =
        selectedRowCBL.length > 0 &&
        exactMatchCBL.length > 0 &&
        selectedRowCBL.some((selectedRow) =>
          exactMatchCBL.some(
            (exactRow) => exactRow["idx"] === selectedRow["idx"],
          ),
        );

      // Check if selected rows are from partial match section
      const isFromPartialMatch =
        selectedRowCBL.length > 0 &&
        partialMatchCBL.length > 0 &&
        selectedRowCBL.some((selectedRow) =>
          partialMatchCBL.some(
            (partialRow) => partialRow["idx"] === selectedRow["idx"],
          ),
        );

      if (isFromExactMatch) {
        // Handle exact match to no match conversion
        // Get original indices before removal
        const cblRowIndices = selectedRowCBL
          .map((selectedRow) =>
            exactMatchCBL.findIndex((row) => row.idx === selectedRow.idx),
          )
          .filter((idx) => idx !== -1);
        const insurerRowIndices = selectedRowInsurer
          .map((selectedRow) =>
            exactMatchInsurer.findIndex((row) => row.idx === selectedRow.idx),
          )
          .filter((idx) => idx !== -1);

        // Add to action history for undo
        addToHistory({
          actionType: "unmatch",
          fromSection: "exact",
          toSection: "no-match",
          cblRows: [...selectedRowCBL],
          insurerRows: [...selectedRowInsurer],
          cblRowIndices,
          insurerRowIndices,
          matrixKey,
        });

        // Handle one-to-many matches by removing all related rows
        const rowsToRemoveCBL = new Set<number>();
        const rowsToRemoveInsurer = new Set<number>();

        // Remove CBL rows and handle one-to-many relationships
        selectedRowCBL.forEach((selectedRow: any) => {
          const selectedIndex = exactMatchCBL.findIndex(
            (row) => row["idx"] === selectedRow["idx"],
          );

          if (selectedIndex !== -1) {
            rowsToRemoveCBL.add(selectedIndex);
            const row = exactMatchCBL[selectedIndex];

            // Check for one-to-many relationships
            if (row.matched_insurer_indices) {
              try {
                const matchedIndices = JSON.parse(row.matched_insurer_indices);
                if (
                  Array.isArray(matchedIndices) &&
                  matchedIndices.length > 1
                ) {
                  // Remove additional CBL rows that are part of the same group
                  const additionalRowsToRemove = matchedIndices.length - 1;
                  for (let i = 1; i <= additionalRowsToRemove; i++) {
                    const nextIndex = selectedIndex + i;
                    if (nextIndex < exactMatchCBL.length) {
                      rowsToRemoveCBL.add(nextIndex);
                    }
                  }
                }
              } catch (error) {
                console.warn("Failed to parse matched_insurer_indices:", error);
              }
            }
          }
        });

        // Remove Insurer rows based on CBL row's matched_insurer_indices
        selectedRowCBL.forEach((selectedCBLRow: any) => {
          const cblIndex = exactMatchCBL.findIndex(
            (row) => row["idx"] === selectedCBLRow["idx"],
          );

          if (cblIndex !== -1) {
            const cblRow = exactMatchCBL[cblIndex];

            // Check for one-to-many relationships in CBL row
            if (cblRow.matched_insurer_indices) {
              try {
                const matchedIndices = JSON.parse(
                  cblRow.matched_insurer_indices,
                );
                if (
                  Array.isArray(matchedIndices) &&
                  matchedIndices.length > 1
                ) {
                  // Find the corresponding insurer rows and remove them
                  // The matchedIndices contains the positions of insurer rows relative to the CBL row
                  for (let i = 0; i < matchedIndices.length; i++) {
                    const insurerIndex = cblIndex + i;
                    if (insurerIndex < exactMatchInsurer.length) {
                      rowsToRemoveInsurer.add(insurerIndex);
                    }
                  }
                } else {
                  // Single match - remove the corresponding insurer row
                  if (cblIndex < exactMatchInsurer.length) {
                    rowsToRemoveInsurer.add(cblIndex);
                  }
                }
              } catch (error) {
                console.warn("Failed to parse matched_insurer_indices:", error);
                // Fallback: remove the corresponding insurer row at the same index
                if (cblIndex < exactMatchInsurer.length) {
                  rowsToRemoveInsurer.add(cblIndex);
                }
              }
            } else {
              // No matched_insurer_indices - remove the corresponding insurer row at the same index
              if (cblIndex < exactMatchInsurer.length) {
                rowsToRemoveInsurer.add(cblIndex);
              }
            }
          }
        });

        // Also remove any directly selected insurer rows
        selectedRowInsurer.forEach((selectedRow: any) => {
          const selectedIndex = exactMatchInsurer.findIndex(
            (row) => row["idx"] === selectedRow["idx"],
          );
          if (selectedIndex !== -1) {
            rowsToRemoveInsurer.add(selectedIndex);
          }
        });

        // Filter out all identified rows
        const updatedExactMatchCBL = exactMatchCBL.filter(
          (_, index) => !rowsToRemoveCBL.has(index),
        );
        const updatedExactMatchInsurer = exactMatchInsurer.filter(
          (_, index) => !rowsToRemoveInsurer.has(index),
        );

        // Regenerate idx after removal
        const regeneratedExactMatchCBL = regenerateIdx(
          updatedExactMatchCBL,
          "exact",
        );
        const regeneratedExactMatchInsurer = regenerateIdx(
          updatedExactMatchInsurer,
          "exact",
        );

        setExactMatchCBL(regeneratedExactMatchCBL);
        setExactMatchInsurer(regeneratedExactMatchInsurer);

        // Get all rows that were removed (including one-to-many relationships)
        const removedCBLRows = exactMatchCBL.filter((_, index) =>
          rowsToRemoveCBL.has(index),
        );
        const removedInsurerRows = exactMatchInsurer.filter((_, index) =>
          rowsToRemoveInsurer.has(index),
        );

        // Add all removed rows to no match sections
        const nextMatchGroup = getNextMatchGroup(noMatchCBL, noMatchInsurer);

        const selectedRowsWithGroup1 = addGroupAndCondition(
          removedCBLRows,
          nextMatchGroup,
        );
        const selectedRowsWithGroup2 = addGroupAndCondition(
          removedInsurerRows,
          nextMatchGroup,
        );

        const newNoMatchFile1Worksheet = [
          ...noMatchCBL,
          ...selectedRowsWithGroup1,
        ];
        const newNoMatchFile2Worksheet = [
          ...noMatchInsurer,
          ...selectedRowsWithGroup2,
        ];

        const updatedNoMatchCBL = regenerateIdx(
          newNoMatchFile1Worksheet,
          "no-match",
        );
        const updatedNoMatchInsurer = regenerateIdx(
          newNoMatchFile2Worksheet,
          "no-match",
        );

        setNoMatchCBL(updatedNoMatchCBL);
        setNoMatchInsurer(updatedNoMatchInsurer);
      } else if (isFromPartialMatch) {
        // Handle partial match to no match conversion

        // Get original indices before removal
        const cblRowIndices = selectedRowCBL
          .map((selectedRow) =>
            partialMatchCBL.findIndex((row) => row.idx === selectedRow.idx),
          )
          .filter((idx) => idx !== -1);
        const insurerRowIndices = selectedRowInsurer
          .map((selectedRow) =>
            partialMatchInsurer.findIndex((row) => row.idx === selectedRow.idx),
          )
          .filter((idx) => idx !== -1);

        // Add to action history for undo
        addToHistory({
          actionType: "unmatch",
          fromSection: "partial",
          toSection: "no-match",
          cblRows: [...selectedRowCBL],
          insurerRows: [...selectedRowInsurer],
          cblRowIndices,
          insurerRowIndices,
          matrixKey,
        });

        // Handle one-to-many matches by removing all related rows
        const rowsToRemoveCBL = new Set<number>();
        const rowsToRemoveInsurer = new Set<number>();

        // Remove CBL rows and handle one-to-many relationships
        selectedRowCBL.forEach((selectedRow: any) => {
          const selectedIndex = partialMatchCBL.findIndex(
            (row) => row["idx"] === selectedRow["idx"],
          );

          if (selectedIndex !== -1) {
            rowsToRemoveCBL.add(selectedIndex);
            const row = partialMatchCBL[selectedIndex];

            // Check for one-to-many relationships
            if (row.matched_insurer_indices) {
              try {
                const matchedIndices = JSON.parse(row.matched_insurer_indices);
                if (
                  Array.isArray(matchedIndices) &&
                  matchedIndices.length > 1
                ) {
                  // Remove additional CBL rows that are part of the same group
                  const additionalRowsToRemove = matchedIndices.length - 1;
                  for (let i = 1; i <= additionalRowsToRemove; i++) {
                    const nextIndex = selectedIndex + i;
                    if (nextIndex < partialMatchCBL.length) {
                      rowsToRemoveCBL.add(nextIndex);
                    }
                  }
                }
              } catch (error) {
                console.warn("Failed to parse matched_insurer_indices:", error);
              }
            }
          }
        });

        // Remove Insurer rows based on CBL row's matched_insurer_indices
        selectedRowCBL.forEach((selectedCBLRow: any) => {
          const cblIndex = partialMatchCBL.findIndex(
            (row) => row["idx"] === selectedCBLRow["idx"],
          );

          if (cblIndex !== -1) {
            const cblRow = partialMatchCBL[cblIndex];

            // Check for one-to-many relationships in CBL row
            if (cblRow.matched_insurer_indices) {
              try {
                const matchedIndices = JSON.parse(
                  cblRow.matched_insurer_indices,
                );
                if (
                  Array.isArray(matchedIndices) &&
                  matchedIndices.length > 1
                ) {
                  // Find the corresponding insurer rows and remove them
                  // The matchedIndices contains the positions of insurer rows relative to the CBL row
                  for (let i = 0; i < matchedIndices.length; i++) {
                    const insurerIndex = cblIndex + i;
                    if (insurerIndex < partialMatchInsurer.length) {
                      rowsToRemoveInsurer.add(insurerIndex);
                    }
                  }
                } else {
                  // Single match - remove the corresponding insurer row
                  if (cblIndex < partialMatchInsurer.length) {
                    rowsToRemoveInsurer.add(cblIndex);
                  }
                }
              } catch (error) {
                console.warn("Failed to parse matched_insurer_indices:", error);
                // Fallback: remove the corresponding insurer row at the same index
                if (cblIndex < partialMatchInsurer.length) {
                  rowsToRemoveInsurer.add(cblIndex);
                }
              }
            } else {
              // No matched_insurer_indices - remove the corresponding insurer row at the same index
              if (cblIndex < partialMatchInsurer.length) {
                rowsToRemoveInsurer.add(cblIndex);
              }
            }
          }
        });

        // Also remove any directly selected insurer rows
        selectedRowInsurer.forEach((selectedRow: any) => {
          const selectedIndex = partialMatchInsurer.findIndex(
            (row) => row["idx"] === selectedRow["idx"],
          );
          if (selectedIndex !== -1) {
            rowsToRemoveInsurer.add(selectedIndex);
          }
        });

        // Filter out all identified rows
        const updatedPartialMatchCBL = partialMatchCBL.filter(
          (_, index) => !rowsToRemoveCBL.has(index),
        );
        const updatedPartialMatchInsurer = partialMatchInsurer.filter(
          (_, index) => !rowsToRemoveInsurer.has(index),
        );

        // Regenerate idx after removal
        const regeneratedPartialMatchCBL = regenerateIdx(
          updatedPartialMatchCBL,
          "partial",
        );
        const regeneratedPartialMatchInsurer = regenerateIdx(
          updatedPartialMatchInsurer,
          "partial",
        );

        setPartialMatchCBL(regeneratedPartialMatchCBL);
        setPartialMatchInsurer(regeneratedPartialMatchInsurer);

        // Get all rows that were removed (including one-to-many relationships)
        const removedCBLRows = partialMatchCBL.filter((_, index) =>
          rowsToRemoveCBL.has(index),
        );
        const removedInsurerRows = partialMatchInsurer.filter((_, index) =>
          rowsToRemoveInsurer.has(index),
        );

        // Add all removed rows to no match sections
        const nextMatchGroup = getNextMatchGroup(noMatchCBL, noMatchInsurer);

        const selectedRowsWithGroup1 = addGroupAndCondition(
          removedCBLRows,
          nextMatchGroup,
        );
        const selectedRowsWithGroup2 = addGroupAndCondition(
          removedInsurerRows,
          nextMatchGroup,
        );

        const newNoMatchFile1Worksheet = [
          ...noMatchCBL,
          ...selectedRowsWithGroup1,
        ];
        const newNoMatchFile2Worksheet = [
          ...noMatchInsurer,
          ...selectedRowsWithGroup2,
        ];

        const updatedNoMatchCBL = regenerateIdx(
          newNoMatchFile1Worksheet,
          "no-match",
        );
        const updatedNoMatchInsurer = regenerateIdx(
          newNoMatchFile2Worksheet,
          "no-match",
        );

        setNoMatchCBL(updatedNoMatchCBL);
        setNoMatchInsurer(updatedNoMatchInsurer);
      }

      setSelectedRowCBL([]);
      setSelectedRowInsurer([]);
      triggerClearAllSelections();
    }
  };

  const handleMoveToExactMatch = () => {
    setPendingAction({ toSection: "exact", actionType: "moveToExact" });
    setRemarksMode("move");
    setCurrentRemarks(
      selectedRowCBL[0]?.Remarks || selectedRowInsurer[0]?.Remarks || "",
    );
    setShowRemarksModal(true);
  };

  const handleMoveToBucket = useCallback(
    (bucketKey: BucketKey) => {
      const actionType =
        bucketKey === "exact"
          ? "moveToExact"
          : bucketKey === "partial"
            ? "moveToPartial"
            : bucketKey === "no-match"
              ? "unmatch"
              : "moveToBucket";

      setPendingAction({ toSection: bucketKey, actionType });
      setRemarksMode("move");
      setCurrentRemarks(
        selectedRowCBL[0]?.Remarks || selectedRowInsurer[0]?.Remarks || "",
      );
      setShowRemarksModal(true);
    },
    [selectedRowCBL, selectedRowInsurer],
  );

  // Apply remarks to selected rows in-place (for standalone "Add Remarks" action)
  const applyRemarksToSelectedRows = useCallback(
    (remarks: string) => {
      if (!remarks.trim()) return;

      const sourceSection = getAllBucketKeys().find((bucketKey) =>
        getBucketRows(bucketKey).cbl.some((row) =>
          selectedRowCBL.some((selected) => selected.idx === row.idx),
        ),
      );

      if (!sourceSection) return;

      const source = getBucketRows(sourceSection);
      const selectedCblIdxs = new Set(selectedRowCBL.map((r) => r.idx));
      const selectedInsurerIdxs = new Set(selectedRowInsurer.map((r) => r.idx));

      if (selectedRowCBL.length > 0) {
        const updatedCBL = source.cbl.map((row) =>
          selectedCblIdxs.has(row.idx) ? { ...row, Remarks: remarks } : row,
        );
        setBucketRows(sourceSection, "cbl", updatedCBL);
      }

      if (selectedRowInsurer.length > 0) {
        const updatedInsurer = source.insurer.map((row) =>
          selectedInsurerIdxs.has(row.idx) ? { ...row, Remarks: remarks } : row,
        );
        setBucketRows(sourceSection, "insurer", updatedInsurer);
      }
    },
    [
      selectedRowCBL,
      selectedRowInsurer,
      getAllBucketKeys,
      getBucketRows,
      setBucketRows,
    ],
  );

  // Helper to find which bucket the current selection belongs to
  const getSelectedSourceSection = useCallback((): BucketKey | null => {
    if (selectedRowCBL.length === 0 && selectedRowInsurer.length === 0) {
      return null;
    }

    return (
      getAllBucketKeys().find((bucketKey) => {
        const bucketRows = getBucketRows(bucketKey);
        return (
          selectedRowCBL.some((selected) =>
            bucketRows.cbl.some((row) => row.idx === selected.idx),
          ) ||
          selectedRowInsurer.some((selected) =>
            bucketRows.insurer.some((row) => row.idx === selected.idx),
          )
        );
      }) || null
    );
  }, [selectedRowCBL, selectedRowInsurer, getAllBucketKeys, getBucketRows]);

  // --- Regroup handlers ---

  const handleSetRegroupTarget = useCallback(
    (row: any, bucket: BucketKey, side: "cbl" | "insurer") => {
      setRegroupTarget({ row, bucket, side });
      setSelectedRowCBL([]);
      setSelectedRowInsurer([]);
      triggerClearAllSelections();
    },
    [
      setRegroupTarget,
      setSelectedRowCBL,
      setSelectedRowInsurer,
      triggerClearAllSelections,
    ],
  );

  const handleClearRegroupTarget = useCallback(() => {
    clearRegroupTarget();
  }, [clearRegroupTarget]);

  const regroupRows = useCallback(
    (remarks?: string) => {
      if (!regroupTarget) return;
      if (selectedRowCBL.length === 0 && selectedRowInsurer.length === 0)
        return;

      const targetBucket = regroupTarget.bucket;
      const targetRow = regroupTarget.row;

      const sourceBucket = getSelectedSourceSection();
      if (!sourceBucket || sourceBucket === targetBucket) return;

      setChanges(true);

      const source = getBucketRows(sourceBucket);
      const target = getBucketRows(targetBucket);

      const isBlankRow = (row: any): boolean =>
        !row.ProcessedAmount || row.ProcessedAmount === "";

      const hasCblSelection = selectedRowCBL.some(
        (r) => r.ProcessedAmount !== "",
      );
      const hasInsurerSelection = selectedRowInsurer.some(
        (r) => r.ProcessedAmount !== "",
      );

      let cblRowsToMove: any[] = [];
      let insurerRowsToMove: any[] = [];
      let orphanedCblRows: any[] = [];
      let orphanedInsurerRows: any[] = [];
      let orphanedCblRowIndices: number[] = [];
      let orphanedInsurerRowIndices: number[] = [];

      if (hasCblSelection) {
        cblRowsToMove = selectedRowCBL.filter((r) => r.ProcessedAmount !== "");
      }
      if (hasInsurerSelection) {
        insurerRowsToMove = selectedRowInsurer.filter(
          (r) => r.ProcessedAmount !== "",
        );
      }

      // CBL only: find corresponding insurer rows → orphan to no-match
      if (hasCblSelection && !hasInsurerSelection) {
        cblRowsToMove.forEach((cblRow) => {
          const cblIndex = source.cbl.findIndex((r) => r.idx === cblRow.idx);
          if (cblIndex === -1) return;
          const srcRow = source.cbl[cblIndex];
          if (srcRow.matched_insurer_indices) {
            try {
              const indices = JSON.parse(srcRow.matched_insurer_indices);
              if (Array.isArray(indices)) {
                for (let i = 0; i < indices.length; i++) {
                  const insurerIndex = cblIndex + i;
                  if (
                    insurerIndex < source.insurer.length &&
                    !isBlankRow(source.insurer[insurerIndex])
                  ) {
                    orphanedInsurerRows.push(source.insurer[insurerIndex]);
                    orphanedInsurerRowIndices.push(insurerIndex);
                  }
                }
              }
            } catch (e) {
              /* ignore */
            }
          }
        });
      }

      // Insurer only: find corresponding CBL rows → orphan to no-match
      if (hasInsurerSelection && !hasCblSelection) {
        const selectedInsurerIdxSet = new Set(
          insurerRowsToMove.map((r) => r.idx),
        );
        source.cbl.forEach((cblRow, cblIndex) => {
          if (isBlankRow(cblRow)) return;
          if (cblRow.matched_insurer_indices) {
            try {
              const indices = JSON.parse(cblRow.matched_insurer_indices);
              if (Array.isArray(indices)) {
                for (let i = 0; i < indices.length; i++) {
                  const insurerIndex = cblIndex + i;
                  if (
                    insurerIndex < source.insurer.length &&
                    selectedInsurerIdxSet.has(source.insurer[insurerIndex].idx)
                  ) {
                    orphanedCblRows.push(cblRow);
                    orphanedCblRowIndices.push(cblIndex);
                    break;
                  }
                }
              }
            } catch (e) {
              /* ignore */
            }
          }
        });
      }

      const originalCblData = cblRowsToMove.map((r) => ({ ...r }));
      const originalInsurerData = insurerRowsToMove.map((r) => ({ ...r }));

      const cblRowIndices = cblRowsToMove
        .map((r) => source.cbl.findIndex((s) => s.idx === r.idx))
        .filter((i) => i !== -1);
      const insurerRowIndices = insurerRowsToMove
        .map((r) => source.insurer.findIndex((s) => s.idx === r.idx))
        .filter((i) => i !== -1);

      // --- Remove from source ---
      const allCblToRemoveIdxs = new Set([
        ...cblRowsToMove.map((r) => r.idx),
        ...orphanedCblRows.map((r) => r.idx),
      ]);
      const allInsurerToRemoveIdxs = new Set([
        ...insurerRowsToMove.map((r) => r.idx),
        ...orphanedInsurerRows.map((r) => r.idx),
      ]);

      // Filter by original position so we can track which blanks to also remove.
      // A blank row should only be removed if the data row it was spacing for
      // (on the opposite side at the same position) was also removed.
      const cblPositionsToRemove = new Set<number>();
      const insPositionsToRemove = new Set<number>();
      source.cbl.forEach((r, i) => {
        if (allCblToRemoveIdxs.has(r.idx)) cblPositionsToRemove.add(i);
      });
      source.insurer.forEach((r, i) => {
        if (allInsurerToRemoveIdxs.has(r.idx)) insPositionsToRemove.add(i);
      });

      // Also mark blank spacers at removed positions on the opposite side
      cblPositionsToRemove.forEach((pos) => {
        if (
          pos < source.insurer.length &&
          isBlankRow(source.insurer[pos]) &&
          !insPositionsToRemove.has(pos)
        ) {
          insPositionsToRemove.add(pos);
        }
      });
      insPositionsToRemove.forEach((pos) => {
        if (
          pos < source.cbl.length &&
          isBlankRow(source.cbl[pos]) &&
          !cblPositionsToRemove.has(pos)
        ) {
          cblPositionsToRemove.add(pos);
        }
      });

      let updatedSourceCBL = source.cbl.filter(
        (_, i) => !cblPositionsToRemove.has(i),
      );
      const updatedSourceInsurer = source.insurer.filter(
        (_, i) => !insPositionsToRemove.has(i),
      );

      if (isMatchedBucket(sourceBucket)) {
        updatedSourceCBL =
          repairParallelMatchedInsurerIndices(updatedSourceCBL);
      }

      setBucketRows(
        sourceBucket,
        "cbl",
        regenerateIdx(updatedSourceCBL, sourceBucket),
      );
      setBucketRows(
        sourceBucket,
        "insurer",
        regenerateIdx(updatedSourceInsurer, sourceBucket),
      );

      // --- Build merged group and append to target ---

      // Resolve target group's match_group value from live data
      const targetSide =
        regroupTarget.side === "cbl" ? target.cbl : target.insurer;
      const targetIndex = findSideRowIndex(targetSide, targetRow);
      const targetMatchGroup =
        targetIndex !== -1
          ? (targetSide[targetIndex]?.match_group ?? targetRow.match_group ?? 1)
          : targetRow.match_group || 1;
      const targetGroupId = targetRow.group_id;

      // Full target block: same parallel range as highlight (matched_insurer_indices),
      // not match_group walks (those stop at blank spacers and drop extra insurer rows).
      const targetGroupCbl: any[] = [];
      const targetGroupInsurer: any[] = [];
      const targetGroupCblIndices = new Set<number>();
      const targetGroupInsurerIndices = new Set<number>();

      const parallelRange = computeRegroupTargetParallelRange(
        target.cbl,
        target.insurer,
        regroupTarget.side,
        targetRow,
      );
      if (parallelRange) {
        const { groupStart, groupEnd } = parallelRange;
        for (let i = groupStart; i <= groupEnd; i++) {
          if (i < target.cbl.length) {
            targetGroupCbl.push(target.cbl[i]);
            targetGroupCblIndices.add(i);
          }
          if (i < target.insurer.length) {
            targetGroupInsurer.push(target.insurer[i]);
            targetGroupInsurerIndices.add(i);
          }
        }
      } else if (targetIndex !== -1) {
        if (targetIndex < target.cbl.length) {
          targetGroupCbl.push(target.cbl[targetIndex]);
          targetGroupCblIndices.add(targetIndex);
        }
        if (targetIndex < target.insurer.length) {
          targetGroupInsurer.push(target.insurer[targetIndex]);
          targetGroupInsurerIndices.add(targetIndex);
        }
      }

      // Remove target group rows from target bucket
      const targetCblWithout = target.cbl.filter(
        (_, i) => !targetGroupCblIndices.has(i),
      );
      const targetInsWithout = target.insurer.filter(
        (_, i) => !targetGroupInsurerIndices.has(i),
      );

      // Update moved source rows to match target group
      const updatedCblRowsToMove = cblRowsToMove.map((row) => ({
        ...row,
        match_group: targetMatchGroup,
        match_condition: "manual match",
        group_id: targetGroupId || row.group_id,
        matched_insurer_indices: undefined,
        ...(remarks?.trim() ? { Remarks: remarks } : {}),
      }));
      const updatedInsurerRowsToMove = insurerRowsToMove.map((row) => ({
        ...row,
        match_group: targetMatchGroup,
        match_condition: "manual match",
        group_id: targetGroupId || row.group_id,
        ...(remarks?.trim() ? { Remarks: remarks } : {}),
      }));

      // Merge real rows first, then recompute spacers for the whole regrouped block.
      // Keeping old per-sub-group spacers creates stale layouts like:
      // target CBL, spacer, moved CBL.
      const targetCblData = targetGroupCbl.filter((r) => !isBlankRow(r));
      const targetInsData = targetGroupInsurer.filter((r) => !isBlankRow(r));

      let equalizedMergedCbl = [...targetCblData, ...updatedCblRowsToMove];
      let equalizedMergedInsurer = [
        ...targetInsData,
        ...updatedInsurerRowsToMove,
      ];

      if (
        isMatchedBucket(targetBucket) &&
        equalizedMergedCbl.length !== equalizedMergedInsurer.length
      ) {
        [equalizedMergedCbl, equalizedMergedInsurer] = equalizeWorksheetLengths(
          equalizedMergedCbl,
          equalizedMergedInsurer,
          targetMatchGroup,
        );
      }

      if (isMatchedBucket(targetBucket)) {
        equalizedMergedCbl =
          repairParallelMatchedInsurerIndices(equalizedMergedCbl);
      }

      // Append recomputed merged group to remaining target.
      const finalTargetCbl = [...targetCblWithout, ...equalizedMergedCbl];
      const finalTargetInsurer = [
        ...targetInsWithout,
        ...equalizedMergedInsurer,
      ];

      setBucketRows(
        targetBucket,
        "cbl",
        regenerateIdx(finalTargetCbl, targetBucket),
      );
      setBucketRows(
        targetBucket,
        "insurer",
        regenerateIdx(finalTargetInsurer, targetBucket),
      );

      // --- Move orphaned rows to no-match ---
      if (orphanedCblRows.length > 0 || orphanedInsurerRows.length > 0) {
        const noMatch = getBucketRows("no-match");
        const orphanedCblCleaned = orphanedCblRows.map((r) => ({
          ...r,
          match_group: undefined,
          match_condition: undefined,
          group_id: undefined,
          matched_insurer_indices: undefined,
        }));
        const orphanedInsurerCleaned = orphanedInsurerRows.map((r) => ({
          ...r,
          match_group: undefined,
          match_condition: undefined,
          group_id: undefined,
        }));

        const newNoMatchCbl = [...noMatch.cbl, ...orphanedCblCleaned];
        const newNoMatchInsurer = [
          ...noMatch.insurer,
          ...orphanedInsurerCleaned,
        ];

        setBucketRows(
          "no-match",
          "cbl",
          regenerateIdx(newNoMatchCbl, "no-match"),
        );
        setBucketRows(
          "no-match",
          "insurer",
          regenerateIdx(newNoMatchInsurer, "no-match"),
        );
      }

      // Add to history for undo
      const matrixKey = generateMatrixKeys(
        [...cblRowsToMove, ...orphanedCblRows],
        [...insurerRowsToMove, ...orphanedInsurerRows],
      );
      setMatrix((prev) => [...prev, matrixKey]);

      addToHistory({
        actionType: "regroup",
        fromSection: sourceBucket,
        toSection: targetBucket,
        cblRows: cblRowsToMove,
        insurerRows: insurerRowsToMove,
        cblRowIndices,
        insurerRowIndices,
        matrixKey,
        orphanedCblRows,
        orphanedInsurerRows,
        orphanedCblRowIndices,
        orphanedInsurerRowIndices,
        originalCblData,
        originalInsurerData,
      });

      const historyCblRows = cblRowsToMove.filter(
        (row) => !isBlankRow(row) && getCanonicalCblFingerprint(row),
      );
      const historyInsurerRows = insurerRowsToMove.filter(
        (row) => !isBlankRow(row) && getCanonicalInsurerFingerprint(row),
      );
      const historyTargetCblRows = targetCblData.filter((row) =>
        getCanonicalCblFingerprint(row),
      );
      const historyTargetInsurerRows = targetInsData.filter((row) =>
        getCanonicalInsurerFingerprint(row),
      );
      const historyOrphanedCblRows = orphanedCblRows.filter((row) =>
        getCanonicalCblFingerprint(row),
      );
      const historyOrphanedInsurerRows = orphanedInsurerRows.filter((row) =>
        getCanonicalInsurerFingerprint(row),
      );

      if (
        historyTargetCblRows.length +
          historyTargetInsurerRows.length +
          historyCblRows.length +
          historyInsurerRows.length >
        0
      ) {
        addMatchHistoryEntry({
          actionType: "regroup",
          cblFingerprints: historyCblRows.map((row) =>
            getCanonicalCblFingerprint(row),
          ),
          insurerFingerprints: historyInsurerRows.map((row) =>
            getCanonicalInsurerFingerprint(row),
          ),
          targetCblFingerprints: historyTargetCblRows.map((row) =>
            getCanonicalCblFingerprint(row),
          ),
          targetInsurerFingerprints: historyTargetInsurerRows.map((row) =>
            getCanonicalInsurerFingerprint(row),
          ),
          orphanedCblFingerprints: historyOrphanedCblRows.map((row) =>
            getCanonicalCblFingerprint(row),
          ),
          orphanedInsurerFingerprints: historyOrphanedInsurerRows.map((row) =>
            getCanonicalInsurerFingerprint(row),
          ),
          cblRemarks: historyCblRows.map((row) => row.Remarks || ""),
          insurerRemarks: historyInsurerRows.map((row) => row.Remarks || ""),
          fromBucket: sourceBucket,
          targetBucket,
          timestamp: new Date().toISOString(),
        });
      }

      // Clear selections and unpin target
      setSelectedRowCBL([]);
      setSelectedRowInsurer([]);
      triggerClearAllSelections();
      clearRegroupTarget();
    },
    [
      regroupTarget,
      selectedRowCBL,
      selectedRowInsurer,
      getSelectedSourceSection,
      getBucketRows,
      setBucketRows,
      setChanges,
      addToHistory,
      addMatchHistoryEntry,
      setMatrix,
      clearRegroupTarget,
      setSelectedRowCBL,
      setSelectedRowInsurer,
      triggerClearAllSelections,
    ],
  );

  const handleRegroupToTarget = useCallback(() => {
    regroupRows();
  }, [regroupRows]);

  // Remarks modal callbacks
  const handleRemarksSubmit = useCallback(
    async (remarks: string) => {
      setShowRemarksModal(false);

      if (remarksMode === "move" && pendingAction) {
        await moveRows(
          pendingAction.toSection,
          pendingAction.actionType,
          remarks,
        );
        setPendingAction(null);
      } else if (remarksMode === "standalone") {
        applyRemarksToSelectedRows(remarks);
        setChanges(true);
      }

      setCurrentRemarks("");
    },
    [
      remarksMode,
      pendingAction,
      moveRows,
      applyRemarksToSelectedRows,
      setChanges,
    ],
  );

  const handleRemarksSkip = useCallback(async () => {
    setShowRemarksModal(false);

    if (pendingAction) {
      await moveRows(pendingAction.toSection, pendingAction.actionType);
      setPendingAction(null);
    }

    setCurrentRemarks("");
  }, [pendingAction, moveRows]);

  const handleRemarksCancel = useCallback(() => {
    setShowRemarksModal(false);
    setPendingAction(null);
    setCurrentRemarks("");
  }, []);

  const handleAddRemarks = useCallback(() => {
    if (selectedRowCBL.length === 0 && selectedRowInsurer.length === 0) return;
    setRemarksMode("standalone");
    setCurrentRemarks(
      selectedRowCBL[0]?.Remarks || selectedRowInsurer[0]?.Remarks || "",
    );
    setShowRemarksModal(true);
  }, [selectedRowCBL, selectedRowInsurer]);

  const getActionMenuItemsForSection = useCallback(
    (sectionKey: BucketKey): MenuProps["items"] => {
      const items: MenuProps["items"] = [];

      if (sectionKey !== "exact") {
        items.push({
          key: "moveToExact",
          label: "Move to Exact Match",
          onClick: () => {
            void handleMoveToBucket("exact");
          },
        });
      }

      if (sectionKey !== "partial") {
        items.push({
          key: "moveToPartial",
          label: "Move to Partial Match",
          onClick: () => {
            void handleMoveToBucket("partial");
          },
        });
      }

      dynamicBuckets
        .filter((bucket) => bucket.BucketKey !== sectionKey)
        .forEach((bucket) => {
          items.push({
            key: `moveTo-${bucket.BucketKey}`,
            label: `Move to ${bucket.BucketName}`,
            onClick: () => {
              void handleMoveToBucket(bucket.BucketKey);
            },
          });
        });

      if (sectionKey !== "no-match") {
        items.push({
          key: "unmatch",
          label: "Move to No Match",
          onClick: () => {
            void handleMoveToBucket("no-match");
          },
        });
      }

      // Add divider and "Add Remarks" option to all sections
      items.push({ type: "divider" as const });
      items.push({
        key: "addRemarks",
        label: "Add Remarks",
        onClick: () => {
          handleAddRemarks();
        },
      });

      return items;
    },
    [dynamicBuckets, handleMoveToBucket, handleAddRemarks],
  );

  const getBucketLabel = useCallback(
    (bucketKey: BucketKey): string => {
      switch (bucketKey) {
        case "exact":
          return "Exact Matches";
        case "partial":
          return "Partial Matches";
        case "no-match":
          return "No Matches";
        default:
          return (
            dynamicBuckets.find((bucket) => bucket.BucketKey === bucketKey)
              ?.BucketName || bucketKey
          );
      }
    },
    [dynamicBuckets],
  );

  // Compute the current idx values for the entire regroup target GROUP.
  // Uses group_id + matched_insurer_indices to determine span instead of
  // walking by match_group (which breaks on blank spacer rows).
  const resolvedRegroupTargetIdxs = useMemo((): string[] => {
    if (!regroupTarget) return [];
    const bucketRows = getBucketRows(regroupTarget.bucket);
    const cblArr = bucketRows.cbl;
    const insArr = bucketRows.insurer;

    const range = computeRegroupTargetParallelRange(
      cblArr,
      insArr,
      regroupTarget.side,
      regroupTarget.row,
    );
    if (!range) return [];

    const { groupStart, groupEnd, targetIndex } = range;
    const targetSide = regroupTarget.side === "cbl" ? cblArr : insArr;
    const idxs: string[] = [];
    for (let i = groupStart; i <= groupEnd; i++) {
      if (i < cblArr.length && cblArr[i]?.idx) idxs.push(cblArr[i].idx);
      if (i < insArr.length && insArr[i]?.idx) idxs.push(insArr[i].idx);
    }
    if (idxs.length === 0) {
      const id = targetSide[targetIndex]?.idx;
      return id !== undefined && id !== null && id !== "" ? [String(id)] : [];
    }
    return idxs;
  }, [regroupTarget, getBucketRows]);

  const selectedSourceSection = getSelectedSourceSection();
  const headerMoveMenuItems: MenuProps["items"] = getAllBucketKeys().map(
    (bucketKey) => ({
      key: bucketKey,
      label: getBucketLabel(bucketKey),
      disabled: !selectedSourceSection || selectedSourceSection === bucketKey,
      onClick: () => {
        void handleMoveToBucket(bucketKey);
      },
    }),
  );

  // Legacy code below - keeping for reference but should be removed
  const _handleMoveToExactMatch_OLD = async () => {
    if (selectedRowCBL.length > 0 && selectedRowInsurer.length > 0) {
      setChanges(true);

      const matrixKey = generateMatrixKeys(selectedRowCBL, selectedRowInsurer);

      setMatrix([...matrix, matrixKey]);

      // Check if selected rows are from no match section
      const isFromNoMatch =
        selectedRowCBL.length > 0 &&
        noMatchCBL.length > 0 &&
        selectedRowCBL.some((selectedRow) =>
          noMatchCBL.some(
            (noMatchRow) => noMatchRow["idx"] === selectedRow["idx"],
          ),
        );

      if (isFromNoMatch) {
        // Handle no match to exact match conversion

        // Get original indices before removal
        const cblRowIndices = selectedRowCBL
          .map((selectedRow) =>
            noMatchCBL.findIndex((row) => row.idx === selectedRow.idx),
          )
          .filter((idx) => idx !== -1);
        const insurerRowIndices = selectedRowInsurer
          .map((selectedRow) =>
            noMatchInsurer.findIndex((row) => row.idx === selectedRow.idx),
          )
          .filter((idx) => idx !== -1);

        // Add to action history for undo
        addToHistory({
          actionType: "moveToExact",
          fromSection: "no-match",
          toSection: "exact",
          cblRows: [...selectedRowCBL],
          insurerRows: [...selectedRowInsurer],
          cblRowIndices,
          insurerRowIndices,
          matrixKey,
        });

        // Remove selected rows from no match sections
        const updatedNoMatchCBL = filterOutSelectedRows(
          noMatchCBL,
          selectedRowCBL,
          "idx",
        );
        const updatedNoMatchInsurer = filterOutSelectedRows(
          noMatchInsurer,
          selectedRowInsurer,
          "idx",
        );

        // Regenerate idx after removal
        const regeneratedNoMatchCBL = regenerateIdx(
          updatedNoMatchCBL,
          "no-match",
        );
        const regeneratedNoMatchInsurer = regenerateIdx(
          updatedNoMatchInsurer,
          "no-match",
        );

        setNoMatchCBL(regeneratedNoMatchCBL);
        setNoMatchInsurer(regeneratedNoMatchInsurer);
      } else {
        // Handle partial match to exact match conversion

        // Get original indices before removal
        const cblRowIndices = selectedRowCBL
          .map((selectedRow) =>
            partialMatchCBL.findIndex((row) => row.idx === selectedRow.idx),
          )
          .filter((idx) => idx !== -1);
        const insurerRowIndices = selectedRowInsurer
          .map((selectedRow) =>
            partialMatchInsurer.findIndex((row) => row.idx === selectedRow.idx),
          )
          .filter((idx) => idx !== -1);

        // Add to action history for undo
        addToHistory({
          actionType: "moveToExact",
          fromSection: "partial",
          toSection: "exact",
          cblRows: [...selectedRowCBL],
          insurerRows: [...selectedRowInsurer],
          cblRowIndices,
          insurerRowIndices,
          matrixKey,
        });

        const { updatedRowsCBL, updatedRowsInsurer, updatedNoMatchInsurer } =
          manualMatching(
            partialMatchCBL,
            partialMatchInsurer,
            selectedRowCBL,
            selectedRowInsurer,
            noMatchInsurer,
            noMatchCBL,
          );
        // Regenerate idx after updating arrays
        const regeneratedPartialMatchCBL = regenerateIdx(
          updatedRowsCBL,
          "partial",
        );
        const regeneratedPartialMatchInsurer = regenerateIdx(
          updatedRowsInsurer,
          "partial",
        );
        const regeneratedNoMatchInsurer = regenerateIdx(
          updatedNoMatchInsurer,
          "no-match",
        );

        setPartialMatchCBL(regeneratedPartialMatchCBL);
        setPartialMatchInsurer(regeneratedPartialMatchInsurer);
        setNoMatchInsurer(regeneratedNoMatchInsurer);
      }

      const nextMatchGroup = getNextMatchGroup(
        exactMatchCBL,
        exactMatchInsurer,
      );

      const selectedRowsWithGroup1 = addGroupAndCondition(
        selectedRowCBL,
        nextMatchGroup,
      );
      const selectedRowsWithGroup2 = addGroupAndCondition(
        selectedRowInsurer,
        nextMatchGroup,
      );

      let newCompleteMatchFile1Worksheet = [
        ...exactMatchCBL,
        ...selectedRowsWithGroup1,
      ];
      let newCompleteMatchFile2Worksheet = [
        ...exactMatchInsurer,
        ...selectedRowsWithGroup2,
      ];

      [newCompleteMatchFile1Worksheet, newCompleteMatchFile2Worksheet] =
        equalizeWorksheetLengths(
          newCompleteMatchFile1Worksheet,
          newCompleteMatchFile2Worksheet,
          nextMatchGroup,
        );

      const updatedExactMatchCBL = regenerateIdx(
        newCompleteMatchFile1Worksheet,
        "exact",
      );
      const updatedExactMatchInsurer = regenerateIdx(
        newCompleteMatchFile2Worksheet,
        "exact",
      );

      setExactMatchCBL(updatedExactMatchCBL);
      setExactMatchInsurer(updatedExactMatchInsurer);

      setSelectedRowCBL([]);
      setSelectedRowInsurer([]);
      triggerClearAllSelections();
    }
  };

  const toasterId = useId("toaster");

  return (
    <>
      <Toaster toasterId={toasterId} />

      <Header />
      <div className={styles.container}>
        {/* Summary Table */}
        <SummaryTable insuranceName={insuranceName || ""} />

        {/* Exact Matches Header */}
        <div className={styles.partialHeader}>
          <div>
            {regroupTarget && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 12px",
                  backgroundColor: "rgba(250, 173, 20, 0.1)",
                  border: "1px solid rgba(250, 173, 20, 0.4)",
                  borderRadius: "4px",
                  fontSize: "13px",
                  color: "#ad6800",
                }}
              >
                Regroup Target: {getBucketLabel(regroupTarget.bucket)} (
                {regroupTarget.side.toUpperCase()})
                <Button
                  size="small"
                  appearance="subtle"
                  onClick={handleClearRegroupTarget}
                  style={{ minWidth: "auto", padding: "2px 6px" }}
                >
                  Clear
                </Button>
              </span>
            )}
          </div>
          <div className="d-flex gap-2">
            <Dropdown
              menu={{ items: headerMoveMenuItems }}
              trigger={["click"]}
              disabled={!selectedSourceSection}
            >
              <span>
                <Button
                  className={styles.btn}
                  appearance="primary"
                  disabled={!selectedSourceSection}
                >
                  Move
                </Button>
              </span>
            </Dropdown>
            <SaveChanges onUndo={handleUndoActions} />
          </div>
        </div>

        {/* Exact Matches */}
        <MatchableComponent
          title="Exact Matches"
          type="exact"
          insuranceName={insuranceName || ""}
          clearSelections={clearAllSelections}
          loading={isLoading}
          onUnmatch={handleUnmatch}
          onAddRemarks={handleAddRemarks}
          actionMenuItems={getActionMenuItemsForSection("exact")}
          regroupTargetIdxs={resolvedRegroupTargetIdxs}
          regroupTargetBucket={regroupTarget?.bucket || null}
          regroupTargetBucketLabel={
            regroupTarget ? getBucketLabel(regroupTarget.bucket) : undefined
          }
          onSetRegroupTarget={handleSetRegroupTarget}
          onClearRegroupTarget={handleClearRegroupTarget}
          onRegroupToTarget={handleRegroupToTarget}
        />

        {/* Partial Matches Bodies */}
        <MatchableComponent
          title="Partial Matches"
          type="partial"
          insuranceName={insuranceName || ""}
          clearSelections={clearAllSelections}
          loading={isLoading}
          onUnmatch={handleUnmatch}
          onMoveToExactMatch={handleMoveToExactMatch}
          onAddRemarks={handleAddRemarks}
          actionMenuItems={getActionMenuItemsForSection("partial")}
          regroupTargetIdxs={resolvedRegroupTargetIdxs}
          regroupTargetBucket={regroupTarget?.bucket || null}
          regroupTargetBucketLabel={
            regroupTarget ? getBucketLabel(regroupTarget.bucket) : undefined
          }
          onSetRegroupTarget={handleSetRegroupTarget}
          onClearRegroupTarget={handleClearRegroupTarget}
          onRegroupToTarget={handleRegroupToTarget}
        />

        {/* No Matches */}
        <MatchableComponent
          title="No Matches"
          type="no-match"
          insuranceName={insuranceName || ""}
          clearSelections={clearAllSelections}
          loading={isLoading}
          onMoveToExactMatch={handleMoveToExactMatch}
          onMoveToPartialMatch={handleMoveToPartialMatch}
          onAddRemarks={handleAddRemarks}
          actionMenuItems={getActionMenuItemsForSection("no-match")}
          regroupTargetIdxs={resolvedRegroupTargetIdxs}
          regroupTargetBucket={regroupTarget?.bucket || null}
          regroupTargetBucketLabel={
            regroupTarget ? getBucketLabel(regroupTarget.bucket) : undefined
          }
          onSetRegroupTarget={handleSetRegroupTarget}
          onClearRegroupTarget={handleClearRegroupTarget}
          onRegroupToTarget={handleRegroupToTarget}
        />

        {dynamicBuckets.map((bucket) => {
          const bucketRows = dynamicBucketData[bucket.BucketKey] || {
            cbl: [],
            insurer: [],
          };

          return (
            <MatchableComponent
              key={bucket.BucketKey}
              title={bucket.BucketName}
              type={bucket.BucketKey}
              insuranceName={insuranceName || ""}
              clearSelections={clearAllSelections}
              loading={isLoading}
              dataFile1Override={bucketRows.cbl}
              dataFile2Override={bucketRows.insurer}
              setMatchesFile1Override={(value) => {
                setDynamicBucketData((prev) => ({
                  ...prev,
                  [bucket.BucketKey]: {
                    ...(prev[bucket.BucketKey] || { cbl: [], insurer: [] }),
                    cbl:
                      typeof value === "function"
                        ? value(prev[bucket.BucketKey]?.cbl || [])
                        : value,
                  },
                }));
              }}
              setMatchesFile2Override={(value) => {
                setDynamicBucketData((prev) => ({
                  ...prev,
                  [bucket.BucketKey]: {
                    ...(prev[bucket.BucketKey] || { cbl: [], insurer: [] }),
                    insurer:
                      typeof value === "function"
                        ? value(prev[bucket.BucketKey]?.insurer || [])
                        : value,
                  },
                }));
              }}
              onAddRemarks={handleAddRemarks}
              actionMenuItems={getActionMenuItemsForSection(bucket.BucketKey)}
              regroupTargetIdxs={resolvedRegroupTargetIdxs}
              regroupTargetBucket={regroupTarget?.bucket || null}
              regroupTargetBucketLabel={
                regroupTarget ? getBucketLabel(regroupTarget.bucket) : undefined
              }
              onSetRegroupTarget={handleSetRegroupTarget}
              onClearRegroupTarget={handleClearRegroupTarget}
              onRegroupToTarget={handleRegroupToTarget}
            />
          );
        })}
      </div>

      <RemarksModal
        show={showRemarksModal}
        onClose={handleRemarksCancel}
        onSubmit={handleRemarksSubmit}
        onSkip={remarksMode === "move" ? handleRemarksSkip : undefined}
        initialRemarks={currentRemarks}
        title={
          remarksMode === "move" ? "Add Remarks Before Moving" : "Add Remarks"
        }
        showSkipButton={remarksMode === "move"}
      />
    </>
  );
}

export default Reconciliation;
