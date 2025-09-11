import React, { useEffect } from "react";
import { useSpContext } from "../../../SpContext";
import "bootstrap/dist/css/bootstrap.min.css";
import { Button, useId, Toaster } from "@fluentui/react-components";
import { fetchFile } from "../../../lib/fetchFiles";
import styles from "../components/Reconciliation.module.scss";
import { IListItemFormUpdateValue } from "@pnp/sp/lists";
import Header from "../../common/Header";
import { useTasks } from "../../../context/TaskContext";
import { useChanges } from "../../../context/ChangesContext";
import { useReconciliation } from "../../../context/ReconciliationContext";
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
} from "../../../lib/utils";
import { generateMatrixKeys } from "../../../lib/generateMatrixKeys";
import { regenerateIdx } from "../../../lib/filterData";

function Reconciliation() {
  const { context, sp } = useSpContext();
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
    cblColumnMappings,
    setCblColumnMappings,
    insuranceColumnMappings,
    setInsuranceColumnMappings,
    matrix,
    setMatrix,
  } = useReconciliation();

  const urlParams = new URLSearchParams(window.location.search);
  const insuranceName = urlParams.get("Insurance");
  const date = urlParams.get("Date");

  const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/${insuranceName}/${date}/output.xlsx`;
  console.log("URL >>> ", url);
  useEffect(() => {
    const fetchData = async () => {
      const {
        exactMatchCBL,
        exactMatchInsurer,
        partialMatchCBL,
        partialMatchInsurer,
        noMatchCBL,
        noMatchInsurer,
      } = await fetchFile(url, sp);
      setExactMatchCBL(exactMatchCBL);
      setExactMatchInsurer(exactMatchInsurer);
      setPartialMatchCBL(partialMatchCBL);
      setPartialMatchInsurer(partialMatchInsurer);
      setNoMatchCBL(noMatchCBL);
      setNoMatchInsurer(noMatchInsurer);
      const { sum1, sum2 } = calculateSum(
        exactMatchCBL,
        exactMatchInsurer,
        cblColumnMappings,
        insuranceColumnMappings
      );
      setExactMatchSum1(sum1);
      setExactMatchSum2(sum2);

      const { sum1: partialMatchSum1, sum2: partialMatchSum2 } = calculateSum(
        partialMatchCBL,
        partialMatchInsurer,
        cblColumnMappings,
        insuranceColumnMappings
      );
      setPartialMatchSum1(partialMatchSum1);
      setPartialMatchSum2(partialMatchSum2);

      const { sum1: noMatchSum1, sum2: noMatchSum2 } = calculateSum(
        noMatchCBL,
        noMatchInsurer,
        cblColumnMappings,
        insuranceColumnMappings
      );
      setNoMatchSum1(noMatchSum1);
      setNoMatchSum2(noMatchSum2);
    };

    const fetchColumnMappings = async () => {
      const columnMappings = await sp.web.lists.getByTitle("Mappings");

      const [{ ColumnMappings: cbl }]: [{ ColumnMappings: string }] =
        await columnMappings.items.filter(`Title eq 'CBL'`)();

      setCblColumnMappings(JSON.parse(cbl));

      const [{ ColumnMappings: insuranceColumnMappings }]: [
        { ColumnMappings: string }
      ] = await columnMappings.items.filter(
        `Title eq '${insuranceName?.toUpperCase()}'`
      )();

      setInsuranceColumnMappings(JSON.parse(insuranceColumnMappings));
    };
    fetchData();
    fetchColumnMappings();
  }, []);

  useEffect(() => {
    const { sum1, sum2 } = calculateSum(
      exactMatchCBL,
      exactMatchInsurer,
      cblColumnMappings,
      insuranceColumnMappings
    );
    setExactMatchSum1(sum1);
    setExactMatchSum2(sum2);

    const { sum1: partialMatchSum1, sum2: partialMatchSum2 } = calculateSum(
      partialMatchCBL,
      partialMatchInsurer,
      cblColumnMappings,
      insuranceColumnMappings
    );
    setPartialMatchSum1(partialMatchSum1);
    setPartialMatchSum2(partialMatchSum2);

    const { sum1: noMatchSum1, sum2: noMatchSum2 } = calculateSum(
      noMatchCBL,
      noMatchInsurer,
      cblColumnMappings,
      insuranceColumnMappings
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
    cblColumnMappings,
    insuranceColumnMappings,
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
          <SaveChanges />
        </div>

        {/* Exact Matches */}
        <MatchableComponent
          title="Exact Matches"
          type="exact"
          insuranceName={insuranceName || ""}
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
        />
      </div>
    </>
  );
}

export default Reconciliation;
