import React, { useEffect, useState, useCallback } from "react";
import { useSpContext } from "../../../SpContext";
import "bootstrap/dist/css/bootstrap.min.css";
import { Button, useId, Toaster } from "@fluentui/react-components";
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
import {
  addGroupAndCondition,
  calculateSum,
  clearSelectedRows,
  equalizeWorksheetLengths,
  filterOutSelectedRows,
  getNextMatchGroup,
  manualMatching,
} from "../../../utils/utils";
import { generateMatrixKeys } from "../../../utils/generateMatrixKeys";
import { regenerateIdx } from "../../../utils/filterData";

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
  } = useReconciliation();

  const urlParams = new URLSearchParams(window.location.search);
  const insuranceName = urlParams.get("Insurance");
  const date = urlParams.get("Date");

  // Helper function to trigger clearing all selections
  const triggerClearAllSelections = useCallback(() => {
    console.log("Triggering clear all selections");
    setClearAllSelections(true);
    // Reset the trigger after a brief delay to allow components to react
    setTimeout(() => {
      setClearAllSelections(false);
    }, 100);
  }, [setClearAllSelections]);

  // Handle undo actions
  const handleUndoActions = useCallback(
    (actionIds: string[]) => {
      console.log("=== handleUndoActions CALLED ===");
      console.log("actionIds received:", actionIds);
      console.log("actionHistory:", actionHistory);
      console.log("Undoing actions:", actionIds);

      // Get the actions to undo (in reverse order - newest first)
      const actionsToUndo = actionHistory
        .filter((action) => actionIds.includes(action.id))
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

      if (actionsToUndo.length === 0) return;

      // Track cumulative changes
      let currentExactMatchCBL = [...exactMatchCBL];
      let currentExactMatchInsurer = [...exactMatchInsurer];
      let currentPartialMatchCBL = [...partialMatchCBL];
      let currentPartialMatchInsurer = [...partialMatchInsurer];
      let currentNoMatchCBL = [...noMatchCBL];
      let currentNoMatchInsurer = [...noMatchInsurer];

      // Process each action in reverse
      actionsToUndo.forEach((action) => {
        console.log("=== Processing undo for action ===");
        console.log("Full action object:", JSON.stringify(action, null, 2));
        console.log("action.cblRowIndices:", action.cblRowIndices);
        console.log("action.insurerRowIndices:", action.insurerRowIndices);

        const {
          fromSection,
          toSection,
          cblRows,
          insurerRows,
          cblRowIndices,
          insurerRowIndices,
        } = action;

        console.log("Destructured values:");
        console.log("  fromSection:", fromSection);
        console.log("  toSection:", toSection);
        console.log("  cblRows count:", cblRows?.length);
        console.log("  insurerRows count:", insurerRows?.length);
        console.log("  cblRowIndices:", cblRowIndices);
        console.log("  insurerRowIndices:", insurerRowIndices);

        // Helper to find and remove rows by matching key fields
        const removeRowsByMatch = (
          sourceArray: any[],
          rowsToRemove: any[]
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
          indices: number[]
        ): any[] => {
          console.log("insertRowsAtIndices called:");
          console.log("  - targetArray length:", targetArray.length);
          console.log("  - rowsToInsert count:", rowsToInsert.length);
          console.log("  - indices:", indices);

          const result = [...targetArray];

          // Pair each row with its original index
          const rowsWithIndices = rowsToInsert.map((row, i) => ({
            row,
            index: indices[i] !== undefined ? indices[i] : result.length + i,
          }));

          console.log(
            "  - rowsWithIndices:",
            rowsWithIndices.map((r) => ({ idx: r.row.idx, index: r.index }))
          );

          // Sort by index in ASCENDING order - this is critical!
          // When we insert at lower indices first, items shift right naturally
          // Example: restoring [b at 1, d at 3] to [a, c, e]
          // - Insert b at 1: [a, b, c, e] (c, e shifted right)
          // - Insert d at 3: [a, b, c, d, e] (e shifts to 4)
          rowsWithIndices.sort((a, b) => a.index - b.index);

          console.log(
            "  - sorted rowsWithIndices:",
            rowsWithIndices.map((r) => ({ idx: r.row.idx, index: r.index }))
          );

          // Insert each row at its original position (NO offset needed!)
          // The splice operation naturally shifts subsequent items
          rowsWithIndices.forEach(({ row, index }) => {
            const insertIndex = Math.min(Math.max(0, index), result.length);
            console.log(
              `  - Inserting row ${row.idx} at index ${insertIndex} (original: ${index})`
            );
            result.splice(insertIndex, 0, row);
          });

          return result;
        };

        // Remove from the destination section
        if (toSection === "exact") {
          currentExactMatchCBL = removeRowsByMatch(
            currentExactMatchCBL,
            cblRows
          );
          currentExactMatchInsurer = removeRowsByMatch(
            currentExactMatchInsurer,
            insurerRows
          );
        } else if (toSection === "partial") {
          currentPartialMatchCBL = removeRowsByMatch(
            currentPartialMatchCBL,
            cblRows
          );
          currentPartialMatchInsurer = removeRowsByMatch(
            currentPartialMatchInsurer,
            insurerRows
          );
        } else if (toSection === "no-match") {
          currentNoMatchCBL = removeRowsByMatch(currentNoMatchCBL, cblRows);
          currentNoMatchInsurer = removeRowsByMatch(
            currentNoMatchInsurer,
            insurerRows
          );
        }

        // Add back to the source section at original indices
        if (fromSection === "exact") {
          currentExactMatchCBL = insertRowsAtIndices(
            currentExactMatchCBL,
            cblRows,
            cblRowIndices || []
          );
          currentExactMatchInsurer = insertRowsAtIndices(
            currentExactMatchInsurer,
            insurerRows,
            insurerRowIndices || []
          );
        } else if (fromSection === "partial") {
          currentPartialMatchCBL = insertRowsAtIndices(
            currentPartialMatchCBL,
            cblRows,
            cblRowIndices || []
          );
          currentPartialMatchInsurer = insertRowsAtIndices(
            currentPartialMatchInsurer,
            insurerRows,
            insurerRowIndices || []
          );
        } else if (fromSection === "no-match") {
          currentNoMatchCBL = insertRowsAtIndices(
            currentNoMatchCBL,
            cblRows,
            cblRowIndices || []
          );
          currentNoMatchInsurer = insertRowsAtIndices(
            currentNoMatchInsurer,
            insurerRows,
            insurerRowIndices || []
          );
        }
      });

      // Regenerate indices for all affected sections
      const regeneratedExactMatchCBL = regenerateIdx(
        currentExactMatchCBL,
        "exact"
      );
      const regeneratedExactMatchInsurer = regenerateIdx(
        currentExactMatchInsurer,
        "exact"
      );
      const regeneratedPartialMatchCBL = regenerateIdx(
        currentPartialMatchCBL,
        "partial"
      );
      const regeneratedPartialMatchInsurer = regenerateIdx(
        currentPartialMatchInsurer,
        "partial"
      );
      const regeneratedNoMatchCBL = regenerateIdx(
        currentNoMatchCBL,
        "no-match"
      );
      const regeneratedNoMatchInsurer = regenerateIdx(
        currentNoMatchInsurer,
        "no-match"
      );

      // Update all state
      setExactMatchCBL(regeneratedExactMatchCBL);
      setExactMatchInsurer(regeneratedExactMatchInsurer);
      setPartialMatchCBL(regeneratedPartialMatchCBL);
      setPartialMatchInsurer(regeneratedPartialMatchInsurer);
      setNoMatchCBL(regeneratedNoMatchCBL);
      setNoMatchInsurer(regeneratedNoMatchInsurer);

      // Remove the undone actions from history
      removeFromHistory(actionIds);

      // Mark changes (so save button becomes enabled)
      setChanges(true);

      // Clear selections
      triggerClearAllSelections();

      console.log("Undo completed successfully");
    },
    [
      actionHistory,
      exactMatchCBL,
      exactMatchInsurer,
      partialMatchCBL,
      partialMatchInsurer,
      noMatchCBL,
      noMatchInsurer,
      setExactMatchCBL,
      setExactMatchInsurer,
      setPartialMatchCBL,
      setPartialMatchInsurer,
      setNoMatchCBL,
      setNoMatchInsurer,
      removeFromHistory,
      setChanges,
      triggerClearAllSelections,
    ]
  );

  const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/${insuranceName}/${date}/output.xlsx`;
  console.log("URL >>> ", url);
  useEffect(() => {
    // Guard clause to ensure sp and required parameters are available
    if (!sp || !insuranceName || !date) {
      console.log("Waiting for required parameters:", {
        sp: !!sp,
        insuranceName,
        date,
      });
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const {
          exactMatchCBL,
          exactMatchInsurer,
          partialMatchCBL,
          partialMatchInsurer,
          noMatchCBL,
          noMatchInsurer,
          columnNames,
        } = await fetchFile(url, sp);
        setExactMatchCBL(exactMatchCBL);
        setExactMatchInsurer(exactMatchInsurer);
        setPartialMatchCBL(partialMatchCBL);
        setPartialMatchInsurer(partialMatchInsurer);
        setNoMatchCBL(noMatchCBL);
        setNoMatchInsurer(noMatchInsurer);

        setCblColumns(columnNames.cbl);
        setInsurerColumns(columnNames.insurer);

        const { sum1, sum2 } = calculateSum(exactMatchCBL, exactMatchInsurer);
        setExactMatchSum1(sum1);
        setExactMatchSum2(sum2);

        const { sum1: partialMatchSum1, sum2: partialMatchSum2 } = calculateSum(
          partialMatchCBL,
          partialMatchInsurer
        );
        setPartialMatchSum1(partialMatchSum1);
        setPartialMatchSum2(partialMatchSum2);

        const { sum1: noMatchSum1, sum2: noMatchSum2 } = calculateSum(
          noMatchCBL,
          noMatchInsurer
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
          { ColumnMappings: string }
        ] = await columnMappings.items.filter(
          `Title eq '${insuranceName?.toUpperCase()}'`
        )();
      } catch (error) {
        console.error("Failed to fetch column mappings:", error);
      }
    };

    fetchData();
    fetchColumnMappings();
  }, [sp, insuranceName, date, url]);

  useEffect(() => {
    const { sum1, sum2 } = calculateSum(exactMatchCBL, exactMatchInsurer);
    setExactMatchSum1(sum1);
    setExactMatchSum2(sum2);

    const { sum1: partialMatchSum1, sum2: partialMatchSum2 } = calculateSum(
      partialMatchCBL,
      partialMatchInsurer
    );
    setPartialMatchSum1(partialMatchSum1);
    setPartialMatchSum2(partialMatchSum2);

    const { sum1: noMatchSum1, sum2: noMatchSum2 } = calculateSum(
      noMatchCBL,
      noMatchInsurer
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

  const handleMoveToPartialMatch = async () => {
    console.log("Moving to partial match");
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
            (noMatchRow) => noMatchRow["idx"] === selectedRow["idx"]
          )
        );

      if (isFromNoMatch) {
        // Handle no match to partial match conversion
        console.log("Moving from no match to partial match");
        console.log("Selected CBL rows:", selectedRowCBL);
        console.log("Selected Insurer rows:", selectedRowInsurer);

        // Get original indices before removal
        const cblRowIndices = selectedRowCBL
          .map((selectedRow) =>
            noMatchCBL.findIndex((row) => row.idx === selectedRow.idx)
          )
          .filter((idx) => idx !== -1);
        const insurerRowIndices = selectedRowInsurer
          .map((selectedRow) =>
            noMatchInsurer.findIndex((row) => row.idx === selectedRow.idx)
          )
          .filter((idx) => idx !== -1);

        // Add to action history for undo
        addToHistory({
          actionType: "moveToPartial",
          fromSection: "no-match",
          toSection: "partial",
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
          "idx"
        );
        const updatedNoMatchInsurer = filterOutSelectedRows(
          noMatchInsurer,
          selectedRowInsurer,
          "idx"
        );

        // Regenerate idx after removal
        const regeneratedNoMatchCBL = regenerateIdx(
          updatedNoMatchCBL,
          "no-match"
        );
        const regeneratedNoMatchInsurer = regenerateIdx(
          updatedNoMatchInsurer,
          "no-match"
        );

        setNoMatchCBL(regeneratedNoMatchCBL);
        setNoMatchInsurer(regeneratedNoMatchInsurer);

        // Add selected rows to partial match sections
        const nextMatchGroup = getNextMatchGroup(
          partialMatchCBL,
          partialMatchInsurer
        );

        const selectedRowsWithGroup1 = addGroupAndCondition(
          selectedRowCBL,
          nextMatchGroup
        );
        const selectedRowsWithGroup2 = addGroupAndCondition(
          selectedRowInsurer,
          nextMatchGroup
        );

        let newPartialMatchFile1Worksheet = [
          ...partialMatchCBL,
          ...selectedRowsWithGroup1,
        ];
        let newPartialMatchFile2Worksheet = [
          ...partialMatchInsurer,
          ...selectedRowsWithGroup2,
        ];

        [newPartialMatchFile1Worksheet, newPartialMatchFile2Worksheet] =
          equalizeWorksheetLengths(
            newPartialMatchFile1Worksheet,
            newPartialMatchFile2Worksheet,
            nextMatchGroup
          );

        const updatedPartialMatchCBL = regenerateIdx(
          newPartialMatchFile1Worksheet,
          "partial"
        );
        const updatedPartialMatchInsurer = regenerateIdx(
          newPartialMatchFile2Worksheet,
          "partial"
        );

        setPartialMatchCBL(updatedPartialMatchCBL);
        setPartialMatchInsurer(updatedPartialMatchInsurer);

        console.log("partialMatchCBL >>> ", partialMatchCBL);
        console.log("partialMatchInsurer >>> ", partialMatchInsurer);
      }

      setSelectedRowCBL([]);
      setSelectedRowInsurer([]);
      triggerClearAllSelections();
    }
  };

  const handleUnmatch = async () => {
    console.log("Unmatching rows");
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
            (exactRow) => exactRow["idx"] === selectedRow["idx"]
          )
        );

      // Check if selected rows are from partial match section
      const isFromPartialMatch =
        selectedRowCBL.length > 0 &&
        partialMatchCBL.length > 0 &&
        selectedRowCBL.some((selectedRow) =>
          partialMatchCBL.some(
            (partialRow) => partialRow["idx"] === selectedRow["idx"]
          )
        );

      if (isFromExactMatch) {
        // Handle exact match to no match conversion
        console.log("Moving from exact match to no match");
        console.log("Selected CBL rows:", selectedRowCBL);
        console.log("Selected Insurer rows:", selectedRowInsurer);

        // Get original indices before removal
        const cblRowIndices = selectedRowCBL
          .map((selectedRow) =>
            exactMatchCBL.findIndex((row) => row.idx === selectedRow.idx)
          )
          .filter((idx) => idx !== -1);
        const insurerRowIndices = selectedRowInsurer
          .map((selectedRow) =>
            exactMatchInsurer.findIndex((row) => row.idx === selectedRow.idx)
          )
          .filter((idx) => idx !== -1);

        console.log("CAPTURED INDICES for exact match unmatch:");
        console.log("  - cblRowIndices:", cblRowIndices);
        console.log("  - insurerRowIndices:", insurerRowIndices);
        console.log("  - exactMatchCBL length:", exactMatchCBL.length);
        console.log("  - exactMatchInsurer length:", exactMatchInsurer.length);

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
            (row) => row["idx"] === selectedRow["idx"]
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
            (row) => row["idx"] === selectedCBLRow["idx"]
          );

          if (cblIndex !== -1) {
            const cblRow = exactMatchCBL[cblIndex];

            // Check for one-to-many relationships in CBL row
            if (cblRow.matched_insurer_indices) {
              try {
                const matchedIndices = JSON.parse(
                  cblRow.matched_insurer_indices
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
            (row) => row["idx"] === selectedRow["idx"]
          );
          if (selectedIndex !== -1) {
            rowsToRemoveInsurer.add(selectedIndex);
          }
        });

        // Filter out all identified rows
        const updatedExactMatchCBL = exactMatchCBL.filter(
          (_, index) => !rowsToRemoveCBL.has(index)
        );
        const updatedExactMatchInsurer = exactMatchInsurer.filter(
          (_, index) => !rowsToRemoveInsurer.has(index)
        );

        // Regenerate idx after removal
        const regeneratedExactMatchCBL = regenerateIdx(
          updatedExactMatchCBL,
          "exact"
        );
        const regeneratedExactMatchInsurer = regenerateIdx(
          updatedExactMatchInsurer,
          "exact"
        );

        setExactMatchCBL(regeneratedExactMatchCBL);
        setExactMatchInsurer(regeneratedExactMatchInsurer);

        // Get all rows that were removed (including one-to-many relationships)
        const removedCBLRows = exactMatchCBL.filter((_, index) =>
          rowsToRemoveCBL.has(index)
        );
        const removedInsurerRows = exactMatchInsurer.filter((_, index) =>
          rowsToRemoveInsurer.has(index)
        );

        // Add all removed rows to no match sections
        const nextMatchGroup = getNextMatchGroup(noMatchCBL, noMatchInsurer);

        const selectedRowsWithGroup1 = addGroupAndCondition(
          removedCBLRows,
          nextMatchGroup
        );
        const selectedRowsWithGroup2 = addGroupAndCondition(
          removedInsurerRows,
          nextMatchGroup
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
          "no-match"
        );
        const updatedNoMatchInsurer = regenerateIdx(
          newNoMatchFile2Worksheet,
          "no-match"
        );

        setNoMatchCBL(updatedNoMatchCBL);
        setNoMatchInsurer(updatedNoMatchInsurer);

        console.log("noMatchCBL >>> ", noMatchCBL);
        console.log("noMatchInsurer >>> ", noMatchInsurer);
      } else if (isFromPartialMatch) {
        // Handle partial match to no match conversion
        console.log("Moving from partial match to no match");
        console.log("Selected CBL rows:", selectedRowCBL);
        console.log("Selected Insurer rows:", selectedRowInsurer);

        // Get original indices before removal
        const cblRowIndices = selectedRowCBL
          .map((selectedRow) =>
            partialMatchCBL.findIndex((row) => row.idx === selectedRow.idx)
          )
          .filter((idx) => idx !== -1);
        const insurerRowIndices = selectedRowInsurer
          .map((selectedRow) =>
            partialMatchInsurer.findIndex((row) => row.idx === selectedRow.idx)
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
            (row) => row["idx"] === selectedRow["idx"]
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
            (row) => row["idx"] === selectedCBLRow["idx"]
          );

          if (cblIndex !== -1) {
            const cblRow = partialMatchCBL[cblIndex];

            // Check for one-to-many relationships in CBL row
            if (cblRow.matched_insurer_indices) {
              try {
                const matchedIndices = JSON.parse(
                  cblRow.matched_insurer_indices
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
            (row) => row["idx"] === selectedRow["idx"]
          );
          if (selectedIndex !== -1) {
            rowsToRemoveInsurer.add(selectedIndex);
          }
        });

        // Filter out all identified rows
        const updatedPartialMatchCBL = partialMatchCBL.filter(
          (_, index) => !rowsToRemoveCBL.has(index)
        );
        const updatedPartialMatchInsurer = partialMatchInsurer.filter(
          (_, index) => !rowsToRemoveInsurer.has(index)
        );

        // Regenerate idx after removal
        const regeneratedPartialMatchCBL = regenerateIdx(
          updatedPartialMatchCBL,
          "partial"
        );
        const regeneratedPartialMatchInsurer = regenerateIdx(
          updatedPartialMatchInsurer,
          "partial"
        );

        setPartialMatchCBL(regeneratedPartialMatchCBL);
        setPartialMatchInsurer(regeneratedPartialMatchInsurer);

        // Get all rows that were removed (including one-to-many relationships)
        const removedCBLRows = partialMatchCBL.filter((_, index) =>
          rowsToRemoveCBL.has(index)
        );
        const removedInsurerRows = partialMatchInsurer.filter((_, index) =>
          rowsToRemoveInsurer.has(index)
        );

        // Add all removed rows to no match sections
        const nextMatchGroup = getNextMatchGroup(noMatchCBL, noMatchInsurer);

        const selectedRowsWithGroup1 = addGroupAndCondition(
          removedCBLRows,
          nextMatchGroup
        );
        const selectedRowsWithGroup2 = addGroupAndCondition(
          removedInsurerRows,
          nextMatchGroup
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
          "no-match"
        );
        const updatedNoMatchInsurer = regenerateIdx(
          newNoMatchFile2Worksheet,
          "no-match"
        );

        setNoMatchCBL(updatedNoMatchCBL);
        setNoMatchInsurer(updatedNoMatchInsurer);

        console.log("noMatchCBL >>> ", noMatchCBL);
        console.log("noMatchInsurer >>> ", noMatchInsurer);
      }

      setSelectedRowCBL([]);
      setSelectedRowInsurer([]);
      triggerClearAllSelections();
    }
  };

  const handleMoveToExactMatch = async () => {
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
            (noMatchRow) => noMatchRow["idx"] === selectedRow["idx"]
          )
        );

      if (isFromNoMatch) {
        // Handle no match to exact match conversion
        console.log("Moving from no match to exact match");
        console.log("Selected CBL rows:", selectedRowCBL);
        console.log("Selected Insurer rows:", selectedRowInsurer);

        // Get original indices before removal
        const cblRowIndices = selectedRowCBL
          .map((selectedRow) =>
            noMatchCBL.findIndex((row) => row.idx === selectedRow.idx)
          )
          .filter((idx) => idx !== -1);
        const insurerRowIndices = selectedRowInsurer
          .map((selectedRow) =>
            noMatchInsurer.findIndex((row) => row.idx === selectedRow.idx)
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
          "idx"
        );
        const updatedNoMatchInsurer = filterOutSelectedRows(
          noMatchInsurer,
          selectedRowInsurer,
          "idx"
        );

        // Regenerate idx after removal
        const regeneratedNoMatchCBL = regenerateIdx(
          updatedNoMatchCBL,
          "no-match"
        );
        const regeneratedNoMatchInsurer = regenerateIdx(
          updatedNoMatchInsurer,
          "no-match"
        );

        setNoMatchCBL(regeneratedNoMatchCBL);
        setNoMatchInsurer(regeneratedNoMatchInsurer);
      } else {
        // Handle partial match to exact match conversion
        console.log("Moving from partial match to exact match");
        console.log("Selected CBL rows:", selectedRowCBL);
        console.log("Selected Insurer rows:", selectedRowInsurer);

        // Get original indices before removal
        const cblRowIndices = selectedRowCBL
          .map((selectedRow) =>
            partialMatchCBL.findIndex((row) => row.idx === selectedRow.idx)
          )
          .filter((idx) => idx !== -1);
        const insurerRowIndices = selectedRowInsurer
          .map((selectedRow) =>
            partialMatchInsurer.findIndex((row) => row.idx === selectedRow.idx)
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
            noMatchCBL
          );
        // Regenerate idx after updating arrays
        const regeneratedPartialMatchCBL = regenerateIdx(
          updatedRowsCBL,
          "partial"
        );
        const regeneratedPartialMatchInsurer = regenerateIdx(
          updatedRowsInsurer,
          "partial"
        );
        const regeneratedNoMatchInsurer = regenerateIdx(
          updatedNoMatchInsurer,
          "no-match"
        );

        setPartialMatchCBL(regeneratedPartialMatchCBL);
        setPartialMatchInsurer(regeneratedPartialMatchInsurer);
        setNoMatchInsurer(regeneratedNoMatchInsurer);
      }

      const nextMatchGroup = getNextMatchGroup(
        exactMatchCBL,
        exactMatchInsurer
      );

      const selectedRowsWithGroup1 = addGroupAndCondition(
        selectedRowCBL,
        nextMatchGroup
      );
      const selectedRowsWithGroup2 = addGroupAndCondition(
        selectedRowInsurer,
        nextMatchGroup
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
          nextMatchGroup
        );

      const updatedExactMatchCBL = regenerateIdx(
        newCompleteMatchFile1Worksheet,
        "exact"
      );
      const updatedExactMatchInsurer = regenerateIdx(
        newCompleteMatchFile2Worksheet,
        "exact"
      );

      setExactMatchCBL(updatedExactMatchCBL);
      setExactMatchInsurer(updatedExactMatchInsurer);

      console.log("exactMatchCBL >>> ", exactMatchCBL);
      console.log("exactMatchInsurer >>> ", exactMatchInsurer);

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
          <div></div>
          <SaveChanges onUndo={handleUndoActions} />
        </div>

        {/* Exact Matches */}
        <MatchableComponent
          title="Exact Matches"
          type="exact"
          insuranceName={insuranceName || ""}
          clearSelections={clearAllSelections}
          loading={isLoading}
          onUnmatch={handleUnmatch}
        />

        {/* Partial Matches Header */}
        <div className={styles.partialHeader}>
          <div></div>
          <div className="d-flex gap-2">
            <Button
              className={styles.btn}
              appearance="primary"
              disabled={
                selectedRowCBL.length === 0 ||
                selectedRowInsurer.length === 0 ||
                // Check if any selected rows are from no match section (can't unmatch from no match)
                selectedRowCBL.some((selectedRow) =>
                  noMatchCBL.some(
                    (noMatchRow) => noMatchRow.idx === selectedRow.idx
                  )
                ) ||
                selectedRowInsurer.some((selectedRow) =>
                  noMatchInsurer.some(
                    (noMatchRow) => noMatchRow.idx === selectedRow.idx
                  )
                )
              }
              onClick={handleUnmatch}
            >
              Unmatch
            </Button>

            <Button
              className={styles.btn}
              appearance="primary"
              disabled={
                selectedRowCBL.length === 0 ||
                selectedRowInsurer.length === 0 ||
                // Check if any selected rows are from exact matches
                selectedRowCBL.some((selectedRow) =>
                  exactMatchCBL.some(
                    (exactRow) => exactRow.idx === selectedRow.idx
                  )
                ) ||
                selectedRowInsurer.some((selectedRow) =>
                  exactMatchInsurer.some(
                    (exactRow) => exactRow.idx === selectedRow.idx
                  )
                )
              }
              onClick={handleMoveToExactMatch}
            >
              Move to exact match
            </Button>
          </div>
        </div>

        {/* Partial Matches Bodies */}
        <MatchableComponent
          title="Partial Matches"
          type="partial"
          insuranceName={insuranceName || ""}
          clearSelections={clearAllSelections}
          loading={isLoading}
          onUnmatch={handleUnmatch}
          onMoveToExactMatch={handleMoveToExactMatch}
        />

        <div className={styles.partialHeader}>
          <div></div>
          <Button
            className={styles.btn}
            appearance="primary"
            disabled={
              selectedRowCBL.length === 0 ||
              selectedRowInsurer.length === 0 ||
              // Check if any selected rows are from no match section
              !selectedRowCBL.some((selectedRow) =>
                noMatchCBL.some(
                  (noMatchRow) => noMatchRow.idx === selectedRow.idx
                )
              ) ||
              !selectedRowInsurer.some((selectedRow) =>
                noMatchInsurer.some(
                  (noMatchRow) => noMatchRow.idx === selectedRow.idx
                )
              )
            }
            onClick={handleMoveToPartialMatch}
          >
            Move to partial match
          </Button>
        </div>

        {/* No Matches */}
        <MatchableComponent
          title="No Matches"
          type="no-match"
          insuranceName={insuranceName || ""}
          clearSelections={clearAllSelections}
          loading={isLoading}
          onMoveToExactMatch={handleMoveToExactMatch}
          onMoveToPartialMatch={handleMoveToPartialMatch}
        />
      </div>
    </>
  );
}

export default Reconciliation;
