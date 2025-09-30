import React, { useState, useEffect } from "react";
import { MoneyRegular, DocumentRegular } from "@fluentui/react-icons";
import styles from "./Reconciliation.module.scss";
import { countNonBlankRows, formatAmount } from "../../../lib/utils";
import MatchableDataTable from "./MatchableDataTable";
import { useReconciliation } from "../../../context/ReconciliationContext";

type MatchableComponentProps = {
  insuranceName: string;
  title?: string;
  type: "exact" | "partial" | "no-match";
  clearSelections?: boolean;
};

function MatchableComponent({
  insuranceName,
  title,
  type,
  clearSelections = false,
}: MatchableComponentProps) {
  const {
    exactMatchCBL,
    setExactMatchCBL,
    exactMatchInsurer,
    setExactMatchInsurer,
    partialMatchCBL,
    setPartialMatchCBL,
    partialMatchInsurer,
    setPartialMatchInsurer,
    noMatchCBL,
    setNoMatchCBL,
    noMatchInsurer,
    setNoMatchInsurer,
    exactMatchSum1,
    setExactMatchSum1,
    exactMatchSum2,
    setExactMatchSum2,
    partialMatchSum1,
    setPartialMatchSum1,
    partialMatchSum2,
    setPartialMatchSum2,
    noMatchSum1,
    setNoMatchSum1,
    noMatchSum2,
    setNoMatchSum2,
    setSelectedRowCBL,
    setSelectedRowInsurer,
    cblColumns,
    insurerColumns,
    clearAllSelections,
  } = useReconciliation();

  // Determine which data to use based on type
  const dataFile1 =
    type === "exact"
      ? exactMatchCBL
      : type === "partial"
      ? partialMatchCBL
      : noMatchCBL;
  const dataFile2 =
    type === "exact"
      ? exactMatchInsurer
      : type === "partial"
      ? partialMatchInsurer
      : noMatchInsurer;
  const sum1 =
    type === "exact"
      ? exactMatchSum1
      : type === "partial"
      ? partialMatchSum1
      : noMatchSum1;
  const sum2 =
    type === "exact"
      ? exactMatchSum2
      : type === "partial"
      ? partialMatchSum2
      : noMatchSum2;

  const setSum1 =
    type === "exact"
      ? setExactMatchSum1
      : type === "partial"
      ? setPartialMatchSum1
      : setNoMatchSum1;
  const setSum2 =
    type === "exact"
      ? setExactMatchSum2
      : type === "partial"
      ? setPartialMatchSum2
      : setNoMatchSum2;
  const setMatchesFile1 =
    type === "exact"
      ? setExactMatchCBL
      : type === "partial"
      ? setPartialMatchCBL
      : setNoMatchCBL;
  const setMatchesFile2 =
    type === "exact"
      ? setExactMatchInsurer
      : type === "partial"
      ? setPartialMatchInsurer
      : setNoMatchInsurer;

  // State to manage cross-table row selection
  const [autoSelectedInsurerRows, setAutoSelectedInsurerRows] = useState<
    string[]
  >([]);

  // Track which CBL rows are selected and their corresponding Insurer mappings
  const [cblSelectionMappings, setCblSelectionMappings] = useState<
    Map<string, string[]>
  >(new Map());

  // Clear cross-table selections when clearSelections prop is true
  useEffect(() => {
    if (clearSelections || clearAllSelections) {
      console.log(
        `Force clearing cross-table selections in MatchableComponent (type: ${type})`
      );
      console.log(
        "Before clearing - autoSelectedInsurerRows:",
        autoSelectedInsurerRows
      );
      console.log(
        "Before clearing - cblSelectionMappings:",
        Array.from(cblSelectionMappings.entries())
      );

      setAutoSelectedInsurerRows([]);
      setCblSelectionMappings(new Map());

      console.log("After clearing - forced cross-table selections to empty");
    }
  }, [
    clearSelections,
    clearAllSelections,
    type,
    autoSelectedInsurerRows,
    cblSelectionMappings,
  ]);

  // Handler for automatic row selection
  const handleRowSelection = (
    selectedRowIndices: string[],
    sourceFileType: 1 | 2,
    sourceRowId?: string,
    isDeselection?: boolean
  ) => {
    console.log("Cross-table selection triggered:", {
      selectedRowIndices,
      sourceFileType,
      sourceRowId,
      isDeselection,
      currentAutoSelected: autoSelectedInsurerRows,
      currentMappings: Array.from(cblSelectionMappings.entries()),
    });

    if (sourceFileType === 1 && sourceRowId) {
      const newMappings = new Map(cblSelectionMappings);

      if (isDeselection) {
        // Remove this CBL row's mapping
        console.log(
          `CBL row ${sourceRowId} deselected - removing its Insurer mappings`
        );
        newMappings.delete(sourceRowId);
      } else {
        // Add/update this CBL row's mapping
        console.log(
          `CBL row ${sourceRowId} selected - adding Insurer mappings:`,
          selectedRowIndices
        );
        newMappings.set(sourceRowId, selectedRowIndices);
      }

      // Update the mappings
      setCblSelectionMappings(newMappings);

      // Calculate all auto-selected Insurer rows from all CBL selections
      const allAutoSelectedRows: string[] = [];
      newMappings.forEach((insurerRows) => {
        allAutoSelectedRows.push(...insurerRows);
      });

      // Remove duplicates
      const uniqueAutoSelectedRows = Array.from(new Set(allAutoSelectedRows));

      console.log(
        "Updated auto-selected Insurer rows:",
        uniqueAutoSelectedRows
      );
      setAutoSelectedInsurerRows(uniqueAutoSelectedRows);
    }
  };

  // Handler for when Insurer table rows are manually toggled
  const handleInsurerRowSelection = (
    selectedRowIndices: string[],
    sourceFileType: 1 | 2,
    sourceRowId?: string,
    isDeselection?: boolean
  ) => {
    console.log("Insurer table manual selection:", {
      selectedRowIndices,
      sourceFileType,
      sourceRowId,
      isDeselection,
    });

    // If user manually deselects auto-selected rows, we might want to handle this
    // For now, we'll allow the manual override without affecting CBL selection
  };

  return (
    <>
      <div>
        <div style={{ marginBottom: "1.5rem" }}>
          <h5>{title ? title : ""}</h5>
          <span
            style={{
              color: sum1 + sum2 < 0 ? "red" : "green",
            }}
          >
            Rs {formatAmount(sum1 + sum2)}
          </span>
        </div>
        <div className={styles.reconciliationContainer}>
          <div className={styles.cardWrapper}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardContent}>
                <div className={styles.infoRow}>
                  <MoneyRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Total Amount</h4>
                    <span className={styles.amount}>
                      Rs {formatAmount(sum1)}
                    </span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <DocumentRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Items</h4>
                    <span className={styles.count}>
                      {countNonBlankRows(dataFile1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>CBL</h3>
              </div>
              <div className={styles.cardBody}>
                <MatchableDataTable
                  fileType={1}
                  data={dataFile1}
                  setPartialMatchesSetter={setMatchesFile1}
                  setSelectedRowData={setSelectedRowCBL}
                  onSumChange={setSum1}
                  columns={cblColumns}
                  onRowSelection={handleRowSelection}
                  clearSelections={clearSelections || clearAllSelections}
                />
              </div>
            </div>
          </div>
          <div className={styles.cardWrapper}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardContent}>
                <div className={styles.infoRow}>
                  <MoneyRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Total Amount</h4>
                    <span className={styles.amount}>
                      Rs {formatAmount(sum2)}
                    </span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <DocumentRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Items</h4>
                    <span className={styles.count}>
                      {countNonBlankRows(dataFile2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>{insuranceName}</h3>
              </div>
              <div className={styles.cardBody}>
                <MatchableDataTable
                  fileType={2}
                  data={dataFile2}
                  setPartialMatchesSetter={setMatchesFile2}
                  setSelectedRowData={setSelectedRowInsurer}
                  onSumChange={setSum2}
                  columns={insurerColumns}
                  externalSelectedRows={autoSelectedInsurerRows}
                  onRowSelection={handleInsurerRowSelection}
                  clearSelections={clearSelections || clearAllSelections}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default MatchableComponent;
