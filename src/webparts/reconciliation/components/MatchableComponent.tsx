import React, { useState, useEffect, useRef } from "react";
import { MoneyRegular, DocumentRegular } from "@fluentui/react-icons";
import type { MenuProps } from "antd";
import styles from "./Reconciliation.module.scss";
import {
  calculateSum,
  countNonBlankRows,
  formatAmount,
} from "../../../utils/utils";
import MatchableDataTable from "./MatchableDataTable";
import { useReconciliation } from "../../../context/ReconciliationContext";
import { BucketKey } from "../../../utils/reconciliationBuckets";

type MatchableComponentProps = {
  insuranceName: string;
  title?: string;
  type: BucketKey;
  clearSelections?: boolean;
  loading?: boolean;
  dataFile1Override?: any[];
  dataFile2Override?: any[];
  setMatchesFile1Override?: React.Dispatch<React.SetStateAction<any[]>>;
  setMatchesFile2Override?: React.Dispatch<React.SetStateAction<any[]>>;
  actionMenuItems?: MenuProps["items"];
  // Action handlers
  onUnmatch?: () => void;
  onMoveToExactMatch?: () => void;
  onMoveToPartialMatch?: () => void;
};

function MatchableComponent({
  insuranceName,
  title,
  type,
  clearSelections = false,
  loading = false,
  dataFile1Override,
  dataFile2Override,
  setMatchesFile1Override,
  setMatchesFile2Override,
  actionMenuItems,
  onUnmatch,
  onMoveToExactMatch,
  onMoveToPartialMatch,
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
    dataFile1Override !== undefined
      ? dataFile1Override
      : type === "exact"
        ? exactMatchCBL
        : type === "partial"
          ? partialMatchCBL
          : noMatchCBL;
  const dataFile2 =
    dataFile2Override !== undefined
      ? dataFile2Override
      : type === "exact"
        ? exactMatchInsurer
        : type === "partial"
          ? partialMatchInsurer
          : noMatchInsurer;

  const calculatedSums = calculateSum(dataFile1, dataFile2);
  const sum1 =
    dataFile1Override !== undefined || dataFile2Override !== undefined
      ? calculatedSums.sum1
      : type === "exact"
        ? exactMatchSum1
        : type === "partial"
          ? partialMatchSum1
          : noMatchSum1;
  const sum2 =
    dataFile1Override !== undefined || dataFile2Override !== undefined
      ? calculatedSums.sum2
      : type === "exact"
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
    setMatchesFile1Override ||
    (type === "exact"
      ? setExactMatchCBL
      : type === "partial"
        ? setPartialMatchCBL
        : setNoMatchCBL);
  const setMatchesFile2 =
    setMatchesFile2Override ||
    (type === "exact"
      ? setExactMatchInsurer
      : type === "partial"
        ? setPartialMatchInsurer
        : setNoMatchInsurer);

  // State to manage cross-table row selection
  const [autoSelectedInsurerRows, setAutoSelectedInsurerRows] = useState<
    string[]
  >([]);

  // Selected subtotals for CBL and Insurer (for difference display)
  const [cblSelectedSubtotal, setCblSelectedSubtotal] = useState<number>(0);
  const [insurerSelectedSubtotal, setInsurerSelectedSubtotal] =
    useState<number>(0);

  // Track which CBL rows are selected and their corresponding Insurer mappings
  const [cblSelectionMappings, setCblSelectionMappings] = useState<
    Map<string, string[]>
  >(new Map());

  // Track which auto-selected rows were manually deselected by the user
  const [manuallyDeselectedRows, setManuallyDeselectedRows] = useState<
    Set<string>
  >(new Set());

  // Shared search state for cross-table search
  const [sharedSearchText, setSharedSearchText] = useState<string>("");

  // Shared page size state for cross-table pagination
  const [sharedPageSize, setSharedPageSize] = useState<number>(50);

  // Shared current page state for cross-table pagination
  const [sharedCurrentPage, setSharedCurrentPage] = useState<number>(1);

  // Scroll synchronization state
  const [syncScrollEnabled, setSyncScrollEnabled] = useState<boolean>(false);
  const [cblScrollTop, setCblScrollTop] = useState<number>(0);
  const [insurerScrollTop, setInsurerScrollTop] = useState<number>(0);
  const isScrollingRef = useRef<boolean>(false);

  // Clear cross-table selections when clearSelections prop is true
  useEffect(() => {
    if (clearSelections || clearAllSelections) {
      setAutoSelectedInsurerRows([]);
      setCblSelectionMappings(new Map());
      setManuallyDeselectedRows(new Set());
    }
  }, [clearSelections, clearAllSelections]);

  // Handler for automatic row selection
  const handleRowSelection = (
    selectedRowIndices: string[],
    sourceFileType: 1 | 2,
    sourceRowId?: string,
    isDeselection?: boolean,
  ) => {
    if (sourceFileType === 1) {
      setCblSelectionMappings((prevMappings) => {
        const newMappings = new Map(prevMappings);

        if (isDeselection) {
          if (sourceRowId) {
            // Remove this specific CBL row's mapping
            newMappings.delete(sourceRowId);
          } else {
            // sourceRowId is undefined - clear all mappings (when no CBL rows are selected)
            newMappings.clear();
          }
        } else {
          // Add/update this CBL row's mapping
          if (sourceRowId) {
            newMappings.set(sourceRowId, selectedRowIndices);
          }
        }

        // Calculate all auto-selected Insurer rows from all CBL selections
        const allAutoSelectedRows: string[] = [];
        newMappings.forEach((insurerRows) => {
          allAutoSelectedRows.push(...insurerRows);
        });

        // Remove duplicates and filter out manually deselected rows
        const uniqueAutoSelectedRows = Array.from(
          new Set(allAutoSelectedRows),
        ).filter((rowId) => !manuallyDeselectedRows.has(rowId));

        // Update insurer rows in the same state update to avoid race conditions
        setAutoSelectedInsurerRows(uniqueAutoSelectedRows);

        return newMappings;
      });
    }
  };

  // Handler for when Insurer table rows are manually toggled
  const handleInsurerRowSelection = (
    _selectedRowIndices: string[],
    _sourceFileType: 1 | 2,
    _sourceRowId?: string,
    _isDeselection?: boolean,
  ) => {
    // If user manually deselects auto-selected rows, we might want to handle this
    // For now, we'll allow the manual override without affecting CBL selection
  };

  // Handler for removing specific auto-selected rows
  const handleRemoveAutoSelection = (rowId: string) => {
    // Mark this row as manually deselected
    const newManuallyDeselected = new Set(manuallyDeselectedRows);
    newManuallyDeselected.add(rowId);
    setManuallyDeselectedRows(newManuallyDeselected);

    // Remove from current auto-selected list
    const newAutoSelected = autoSelectedInsurerRows.filter(
      (id) => id !== rowId,
    );
    setAutoSelectedInsurerRows(newAutoSelected);
  };

  // Handler for re-selecting a manually deselected row
  const handleRestoreAutoSelection = (rowId: string) => {
    // Remove from manually deselected set
    const newManuallyDeselected = new Set(manuallyDeselectedRows);
    newManuallyDeselected.delete(rowId);
    setManuallyDeselectedRows(newManuallyDeselected);

    // Check if this row should be auto-selected based on current CBL mappings
    const allMappedRows: string[] = [];
    Array.from(cblSelectionMappings.values()).forEach((rows) => {
      allMappedRows.push(...rows);
    });
    const shouldBeAutoSelected = allMappedRows.includes(rowId);

    if (shouldBeAutoSelected && !autoSelectedInsurerRows.includes(rowId)) {
      const newAutoSelected = [...autoSelectedInsurerRows, rowId];
      setAutoSelectedInsurerRows(newAutoSelected);
    }
  };

  // Handler for CBL table scroll
  const handleCblScroll = (scrollTop: number) => {
    if (!syncScrollEnabled || isScrollingRef.current) return;
    isScrollingRef.current = true;
    setCblScrollTop(scrollTop);
    setInsurerScrollTop(scrollTop);
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 50);
  };

  // Handler for Insurer table scroll
  const handleInsurerScroll = (scrollTop: number) => {
    if (!syncScrollEnabled || isScrollingRef.current) return;
    isScrollingRef.current = true;
    setInsurerScrollTop(scrollTop);
    setCblScrollTop(scrollTop);
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 50);
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
                  loading={loading}
                  searchText={sharedSearchText}
                  onSearchChange={setSharedSearchText}
                  pageSize={sharedPageSize}
                  onPageSizeChange={setSharedPageSize}
                  currentPage={sharedCurrentPage}
                  onCurrentPageChange={setSharedCurrentPage}
                  sectionType={type}
                  onUnmatch={onUnmatch}
                  onMoveToExactMatch={onMoveToExactMatch}
                  onMoveToPartialMatch={onMoveToPartialMatch}
                  actionMenuItems={actionMenuItems}
                  syncScrollEnabled={syncScrollEnabled}
                  onSyncScrollChange={setSyncScrollEnabled}
                  onScroll={handleCblScroll}
                  externalScrollTop={insurerScrollTop}
                  onSelectedSubtotalChange={setCblSelectedSubtotal}
                  otherSectionSubtotal={insurerSelectedSubtotal}
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
                  onRemoveAutoSelection={handleRemoveAutoSelection}
                  onRestoreAutoSelection={handleRestoreAutoSelection}
                  manuallyDeselectedRows={Array.from(manuallyDeselectedRows)}
                  clearSelections={clearSelections || clearAllSelections}
                  loading={loading}
                  searchText={sharedSearchText}
                  onSearchChange={setSharedSearchText}
                  pageSize={sharedPageSize}
                  onPageSizeChange={setSharedPageSize}
                  currentPage={sharedCurrentPage}
                  onCurrentPageChange={setSharedCurrentPage}
                  sectionType={type}
                  onUnmatch={onUnmatch}
                  onMoveToExactMatch={onMoveToExactMatch}
                  onMoveToPartialMatch={onMoveToPartialMatch}
                  actionMenuItems={actionMenuItems}
                  syncScrollEnabled={syncScrollEnabled}
                  onScroll={handleInsurerScroll}
                  externalScrollTop={cblScrollTop}
                  onSelectedSubtotalChange={setInsurerSelectedSubtotal}
                  otherSectionSubtotal={cblSelectedSubtotal}
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
