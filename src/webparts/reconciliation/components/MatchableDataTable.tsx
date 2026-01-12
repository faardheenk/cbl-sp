import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Table, Button, Tooltip, Input } from "antd";
import { ColumnsType } from "antd/es/table";
import { Resizable, ResizeCallbackData } from "react-resizable";
import {
  EyeInvisibleOutlined,
  SearchOutlined,
  UpOutlined,
  DownOutlined,
} from "@ant-design/icons";
import "react-resizable/css/styles.css";

// Custom styles for resizable handles and consistent row heights
const resizableStyles = `
  .react-resizable-handle {
    position: absolute;
    right: -5px;
    bottom: 0;
    top: 0;
    width: 10px;
    cursor: col-resize;
    z-index: 1;
  }
  .react-resizable-handle::after {
    content: '';
    position: absolute;
    right: 3px;
    top: 50%;
    width: 4px;
    height: 20px;
    background: #ccc;
    transform: translateY(-50%);
    border-radius: 2px;
  }
  .react-resizable-handle:hover::after {
    background: #999;
  }
  
  /* Consistent row heights - scoped to our table */
  .consistent-height-table .ant-table-tbody > tr > td {
    height: 40px !important;
    padding: 8px 12px !important;
    vertical-align: middle !important;
    line-height: 1.4 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
  }
  
  .consistent-height-table .ant-table-thead > tr > th {
    height: 44px !important;
    padding: 10px 12px !important;
    vertical-align: middle !important;
    box-sizing: border-box !important;
  }
  
  /* Ensure content fits within fixed height */
  .consistent-height-table .ant-table-cell {
    max-width: 0 !important;
  }
  
  .consistent-height-table .ant-table-cell > * {
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    display: block !important;
  }
  
  /* Fix for row hover effects */
  .consistent-height-table .ant-table-tbody > tr:hover > td {
    background-color: #f5f5f5 !important;
    cursor: pointer !important;
  }
  
  /* Ensure consistent spacing */
  .consistent-height-table .ant-table-tbody > tr {
    height: 40px !important;
  }
  
  .consistent-height-table .ant-table-thead > tr {
    height: 44px !important;
  }
  
  /* Selected row styling */
  .consistent-height-table .ant-table-tbody > tr.selected-row > td {
    background-color: rgba(68, 129, 221, 0.1) !important;
  }
  
  .consistent-height-table .ant-table-tbody > tr.selected-row:hover > td {
    background-color: rgba(68, 129, 221, 0.2) !important;
  }
  
  /* Auto-selected row styling */
  .consistent-height-table .ant-table-tbody > tr.auto-selected-row > td {
    background-color: rgba(34, 197, 94, 0.1) !important; /* Green tint for auto-selected */
    border-left: 3px solid rgba(34, 197, 94, 0.6) !important; /* Green left border */
  }
  
  .consistent-height-table .ant-table-tbody > tr.auto-selected-row:hover > td {
    background-color: rgba(34, 197, 94, 0.2) !important;
  }

  /* Manually deselected row styling - subtle indication it can be restored */
  .consistent-height-table .ant-table-tbody > tr.manually-deselected-row > td {
    background-color: rgba(156, 163, 175, 0.1) !important; /* Light gray tint */
    border-left: 2px dashed rgba(156, 163, 175, 0.5) !important; /* Dashed gray border */
  }

  .consistent-height-table .ant-table-tbody > tr.manually-deselected-row:hover > td {
    background-color: rgba(34, 197, 94, 0.1) !important; /* Green on hover to indicate it can be restored */
    cursor: pointer !important;
  }
  
  /* Empty row styling */
  .consistent-height-table .ant-table-tbody > tr.empty-row > td {
    background-color: #f5f5f5 !important;
    opacity: 0.7 !important;
  }
  
  /* Hide Ant Design's internal measure row */
  .consistent-height-table .ant-table-measure-row {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    overflow: hidden !important;
  }
  
  .consistent-height-table .ant-table-measure-row > td {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    padding: 0 !important;
    border: none !important;
  }
`;

// Inject styles
if (typeof document !== "undefined") {
  const styleElement = document.createElement("style");
  styleElement.textContent = resizableStyles;
  document.head.appendChild(styleElement);
}

type Props = {
  data: any[];
  setPartialMatchesSetter: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedRowData?: React.Dispatch<React.SetStateAction<any[]>>;
  fileType: 1 | 2;
  onSumChange: (sum: number) => void;
  columns: ColumnsType;
  onColumnsChange?: (columns: ColumnsType) => void;
  onRowSelection?: (
    selectedRowIndices: string[],
    sourceFileType: 1 | 2,
    sourceRowId?: string,
    isDeselection?: boolean
  ) => void;
  onRemoveAutoSelection?: (rowId: string) => void;
  onRestoreAutoSelection?: (rowId: string) => void;
  manuallyDeselectedRows?: string[];
  externalSelectedRows?: string[];
  clearSelections?: boolean;
  loading?: boolean;
  searchText?: string;
  onSearchChange?: (searchText: string) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  currentPage?: number;
  onCurrentPageChange?: (currentPage: number) => void;
};

// Resizable title component with hide button
const ResizableTitle = (props: any) => {
  const { onResize, width, onHideColumn, columnKey, children, ...restProps } =
    props;

  if (!width) {
    return <th {...restProps}>{children}</th>;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          onClick={(e) => {
            e.stopPropagation();
          }}
          style={{
            position: "absolute",
            right: -5,
            top: 0,
            bottom: 0,
            width: 10,
            cursor: "col-resize",
            zIndex: 1,
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{children}</span>
          <Tooltip title="Hide column">
            <Button
              type="text"
              size="small"
              icon={<EyeInvisibleOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onHideColumn && onHideColumn(columnKey);
              }}
              style={{
                padding: "2px 4px",
                height: "20px",
                minWidth: "20px",
                marginLeft: "4px",
                opacity: 0.6,
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.opacity = "0.6";
              }}
            />
          </Tooltip>
        </div>
      </th>
    </Resizable>
  );
};

function MatchableDataTable({
  data,
  setPartialMatchesSetter,
  setSelectedRowData,
  fileType,
  onSumChange,
  columns,
  onColumnsChange,
  onRowSelection,
  onRemoveAutoSelection,
  onRestoreAutoSelection,
  manuallyDeselectedRows = [],
  externalSelectedRows = [],
  clearSelections = false,
  loading = false,
  searchText: externalSearchText,
  onSearchChange,
  pageSize: externalPageSize,
  onPageSizeChange,
  currentPage: externalCurrentPage,
  onCurrentPageChange,
}: Props) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [previousDataLength, setPreviousDataLength] = useState<number>(
    data.length
  );
  // Use external search text if provided, otherwise use local state
  const [localSearchText, setLocalSearchText] = useState<string>("");
  const searchText =
    externalSearchText !== undefined ? externalSearchText : localSearchText;
  const handleSearchChange = onSearchChange || setLocalSearchText;

  // Track which rows were auto-selected vs manually selected
  const [manuallySelectedRows, setManuallySelectedRows] = useState<string[]>(
    []
  );

  // Ref for table wrapper to enable scrolling
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const previousExternalSelectedRowsRef = useRef<string[]>([]);

  // Track current navigation index through selected rows
  const [currentNavigationIndex, setCurrentNavigationIndex] =
    useState<number>(-1);

  // Pagination state - use external if provided, otherwise local
  const [localPageSize, setLocalPageSize] = useState<number>(50);
  const pageSize =
    externalPageSize !== undefined ? externalPageSize : localPageSize;
  const handlePageSizeChange = onPageSizeChange || setLocalPageSize;

  const [localCurrentPage, setLocalCurrentPage] = useState<number>(1);
  const currentPage =
    externalCurrentPage !== undefined ? externalCurrentPage : localCurrentPage;
  const handleCurrentPageChange = onCurrentPageChange || setLocalCurrentPage;

  // Filter data based on search text
  const filteredData = useMemo(() => {
    if (!searchText.trim()) return data;

    const searchLower = searchText.toLowerCase();
    return data.filter((row) => {
      return Object.values(row).some((value) => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchLower);
      });
    });
  }, [data, searchText]);

  // Scroll to newly auto-selected rows (for Insurer table when CBL row is clicked)
  useEffect(() => {
    if (
      fileType === 2 &&
      externalSelectedRows.length > 0 &&
      tableWrapperRef.current
    ) {
      const previousRows = previousExternalSelectedRowsRef.current;
      const newlySelectedRows = externalSelectedRows.filter(
        (rowId) => !previousRows.includes(rowId)
      );

      if (newlySelectedRows.length > 0) {
        // Find the first newly selected row in the DOM and scroll to it
        setTimeout(() => {
          const firstNewRowId = newlySelectedRows[0];
          // Try multiple selectors as Ant Design might use different attributes
          const rowElement =
            (tableWrapperRef.current?.querySelector(
              `tr[data-row-key="${firstNewRowId}"]`
            ) as HTMLElement) ||
            (tableWrapperRef.current?.querySelector(
              `.ant-table-tbody tr[data-row-key="${firstNewRowId}"]`
            ) as HTMLElement) ||
            (tableWrapperRef.current?.querySelector(
              `.consistent-height-table tr[data-row-key="${firstNewRowId}"]`
            ) as HTMLElement);

          if (rowElement) {
            // Find the scrollable container (Ant Design table body)
            const scrollContainer = tableWrapperRef.current?.querySelector(
              ".ant-table-body"
            ) as HTMLElement;

            if (scrollContainer) {
              // Calculate the position relative to the scroll container
              const rowRect = rowElement.getBoundingClientRect();
              const containerRect = scrollContainer.getBoundingClientRect();
              const scrollTop =
                scrollContainer.scrollTop +
                (rowRect.top - containerRect.top) -
                containerRect.height / 2 +
                rowRect.height / 2;

              scrollContainer.scrollTo({
                top: scrollTop,
                behavior: "smooth",
              });
            } else {
              // Fallback to scrollIntoView if scroll container not found
              rowElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
          }
        }, 150); // Small delay to ensure DOM is updated
      }
    }

    // Update the ref with current external selected rows
    previousExternalSelectedRowsRef.current = [...externalSelectedRows];
  }, [externalSelectedRows, fileType]);

  // Clear all selections when clearSelections prop is true
  useEffect(() => {
    if (clearSelections) {
      console.log(
        `Force clearing all selections in MatchableDataTable (fileType: ${fileType})`
      );
      console.log("Before clearing - selectedRows:", selectedRows);
      console.log(
        "Before clearing - manuallySelectedRows:",
        manuallySelectedRows
      );
      console.log(
        "Before clearing - externalSelectedRows:",
        externalSelectedRows
      );

      setSelectedRows([]);
      setManuallySelectedRows([]);
      previousExternalSelectedRowsRef.current = [];
      if (setSelectedRowData) {
        setSelectedRowData([]);
      }

      console.log("After clearing - forced all selections to empty");
    }
  }, [
    clearSelections,
    setSelectedRowData,
    fileType,
    selectedRows,
    manuallySelectedRows,
    externalSelectedRows,
  ]);

  // Update selected rows when external selection changes
  useEffect(() => {
    console.log("External selection changed:", externalSelectedRows);
    console.log("Current manual selections:", manuallySelectedRows);

    // Combine manual selections with external selections
    const newSelectedRows = [...manuallySelectedRows, ...externalSelectedRows];

    // Only update if selection actually changed
    if (
      JSON.stringify(selectedRows.sort()) !==
      JSON.stringify(newSelectedRows.sort())
    ) {
      console.log("Updating selected rows:", newSelectedRows);
      setSelectedRows(newSelectedRows);
    }

    // Update the global selected row data for auto-selected rows
    if (setSelectedRowData) {
      const selectedData = data.filter((row) =>
        externalSelectedRows.includes(row.idx)
      );
      const autoSelectedData = selectedData.map((row) => ({
        ...row,
        match_condition: "auto match",
      }));

      setSelectedRowData((prevData) => {
        // Remove any existing auto-selected rows and add new ones
        const manualData = prevData.filter(
          (row) => row.match_condition !== "auto match"
        );
        const newData = [...manualData, ...autoSelectedData];

        // Only update if data actually changed
        if (JSON.stringify(prevData) !== JSON.stringify(newData)) {
          return newData;
        }
        return prevData;
      });
    }
  }, [
    externalSelectedRows,
    manuallySelectedRows,
    data,
    setSelectedRowData,
    selectedRows,
  ]);

  // Helper function to parse matched_insurer_indices and calculate target row indices
  const calculateTargetRowIndices = useCallback((row: any): string[] => {
    if (
      !row.matched_insurer_indices ||
      typeof row.matched_insurer_indices !== "string"
    ) {
      return [];
    }

    try {
      // Parse the string into an array
      const indices = JSON.parse(row.matched_insurer_indices);
      if (!Array.isArray(indices)) {
        return [];
      }

      // Get the current row's idx and extract the numeric part
      const currentIdx = row.idx;
      const currentNumericPart = currentIdx.replace(/[^0-9]/g, "");
      const baseIndex = parseInt(currentNumericPart, 10);

      if (isNaN(baseIndex)) {
        return [];
      }

      // Calculate target indices based on the array length and base index
      const targetIndices: string[] = [];
      for (let i = 0; i < indices.length; i++) {
        // Generate target idx with same prefix as current row but incremented number
        const prefix = currentIdx.replace(/[0-9]+/, "");
        const targetIdx = `${prefix}${baseIndex + i}`;
        targetIndices.push(targetIdx);
      }

      console.log("Calculated target indices:", targetIndices);
      return targetIndices;
    } catch (error) {
      console.error("Error parsing matched_insurer_indices:", error);
      return [];
    }
  }, []);

  // Initialize column widths - default width of 150px for each column
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>(
    {}
  );

  // Track hidden columns
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  // Update column widths when columns change
  useEffect(() => {
    const widths: { [key: string]: number } = {};
    columns.forEach((col: any) => {
      widths[col.key] = col.width || 150;
    });
    setColumnWidths((prevWidths) => ({
      ...widths,
      ...prevWidths, // Keep existing widths if they exist
    }));
  }, [columns]);

  // Handle column resize
  const handleResize =
    (index: number) =>
    (e: any, { size }: ResizeCallbackData) => {
      const visibleColumns = columns.filter(
        (col: any) => !hiddenColumns.has(col.key)
      );
      const newColumnWidths = { ...columnWidths };
      const columnKey = visibleColumns[index]?.key as string;
      if (columnKey) {
        newColumnWidths[columnKey] = size.width;
        setColumnWidths(newColumnWidths);
      }
    };

  // Handle hiding a column
  const handleHideColumn = (columnKey: string) => {
    const newHiddenColumns = new Set(hiddenColumns);
    newHiddenColumns.add(columnKey);
    setHiddenColumns(newHiddenColumns);

    // Notify parent component if callback provided
    if (onColumnsChange) {
      const visibleColumns = columns.filter(
        (col: any) => !newHiddenColumns.has(col.key)
      );
      onColumnsChange(visibleColumns);
    }
  };

  // Create resizable columns (filter out hidden columns)
  const visibleColumns = columns.filter(
    (col: any) => !hiddenColumns.has(col.key)
  );
  const resizableColumns = visibleColumns.map((col: any, index: number) => ({
    ...col,
    width: columnWidths[col.key] || 150,
    onHeaderCell: (column: any) => ({
      width: columnWidths[col.key] || 150,
      onResize: handleResize(index),
      onHideColumn: handleHideColumn,
      columnKey: col.key,
    }),
  }));

  // Clear selected rows when data length decreases (indicating rows were removed)
  useEffect(() => {
    if (data.length < previousDataLength) {
      console.log(
        `Data length decreased from ${previousDataLength} to ${data.length}, clearing selections`
      );
      setSelectedRows([]);
      // Also clear the global selected row data
      if (setSelectedRowData) {
        setSelectedRowData([]);
      }
    }
    setPreviousDataLength(data.length);
  }, [data.length, previousDataLength, setSelectedRowData]);

  // Calculate subtotal of selected rows
  const selectedRowsSubtotal = useMemo(() => {
    const selectedData = data.filter((row) => selectedRows.includes(row.idx));

    return selectedData.reduce((acc, row) => {
      const amount = parseFloat(row["ProcessedAmount"]) || 0;
      return acc + amount;
    }, 0);
  }, [selectedRows, data]);

  // console.log("partialMatches", partialMatches);
  // console.log("selectedRows", selectedRows);

  const handleRowClicked = useCallback(
    (row: any) => {
      // Check if the row is empty (all values are empty strings)
      // const isEmptyRow = Object.values(row).every((value) => value === "");
      const isEmptyRow = row.ProcessedAmount === "";

      console.log("isEmptyRow >>> ", isEmptyRow);
      console.log("row clicked >>> ", row);
      console.log("current selectedRows >>> ", selectedRows);

      // If the row is empty, don't allow selection
      if (isEmptyRow) {
        return;
      }

      // Check if this row was auto-selected or manually deselected
      const isAutoSelected = externalSelectedRows.includes(row.idx);
      const wasManuallyDeselected = manuallyDeselectedRows.includes(row.idx);

      // Toggle selection
      const isCurrentlySelected = selectedRows.includes(row.idx);
      const isManuallySelected = manuallySelectedRows.includes(row.idx);

      // Update manually selected rows
      if (isManuallySelected) {
        // Remove from manual selection
        const newManualSelection = manuallySelectedRows.filter(
          (id) => id !== row.idx
        );
        console.log("Removing from manual selection:", row.idx);
        setManuallySelectedRows(newManualSelection);
      } else if (isAutoSelected) {
        // Auto-selected row clicked - remove it from auto-selection
        console.log(
          "Auto-selected row clicked - removing from auto-selection:",
          row.idx
        );
        if (onRemoveAutoSelection) {
          onRemoveAutoSelection(row.idx);
        }
        return; // Don't add to manual selection, just remove from auto
      } else if (wasManuallyDeselected) {
        // Previously auto-selected row that was manually deselected - restore it
        console.log(
          "Manually deselected row clicked - restoring to auto-selection:",
          row.idx
        );
        if (onRestoreAutoSelection) {
          onRestoreAutoSelection(row.idx);
        }
        return; // Don't add to manual selection, restore to auto
      } else {
        // Regular row - add to manual selection
        const newManualSelection = [...manuallySelectedRows, row.idx];
        console.log("Adding to manual selection:", row.idx);
        setManuallySelectedRows(newManualSelection);
      }

      // Update the global selected row data
      if (setSelectedRowData) {
        setSelectedRowData((prev) => {
          if (prev.some((r) => r.idx === row.idx)) {
            // Remove the row from selection
            return prev.filter((r) => r.idx !== row.idx);
          } else {
            // Add the row to selection
            const matchCondition = isAutoSelected
              ? "auto match"
              : "manual match";
            return [...prev, { ...row, match_condition: matchCondition }];
          }
        });
      }

      // Handle CBL table (fileType 1) automatic highlighting logic
      if (fileType === 1) {
        if (!isCurrentlySelected && onRowSelection) {
          // Selecting a CBL row - trigger automatic highlighting
          const targetIndices = calculateTargetRowIndices(row);
          console.log(
            "CBL row selected, triggering auto-highlight for indices:",
            targetIndices
          );
          console.log(
            "matched_insurer_indices raw value:",
            row.matched_insurer_indices
          );

          if (targetIndices.length > 0) {
            onRowSelection(targetIndices, fileType, row.idx, false);
          }
        } else if (isCurrentlySelected && onRowSelection) {
          // Deselecting a CBL row - clear automatic highlighting
          console.log("CBL row deselected, clearing auto-highlight");
          onRowSelection([], fileType, row.idx, true);
        }
      }

      // Handle Insurer table (fileType 2) - allow manual toggle of auto-selected rows
      if (fileType === 2 && isAutoSelected && isCurrentlySelected) {
        // User is manually deselecting an auto-selected row
        console.log("Manually deselecting auto-selected row:", row.idx);
        // The row will be removed from selection by the logic above
      }
    },
    [
      selectedRows,
      manuallySelectedRows,
      manuallyDeselectedRows,
      externalSelectedRows,
      fileType,
      setSelectedRowData,
      onRowSelection,
      onRemoveAutoSelection,
      onRestoreAutoSelection,
      calculateTargetRowIndices,
    ]
  );

  // Function to determine row class name based on row state
  const getRowClassName = useCallback(
    (record: any) => {
      const isSelected = selectedRows.includes(record.idx);
      const isAutoSelected = externalSelectedRows.includes(record.idx);
      const isManuallySelected = manuallySelectedRows.includes(record.idx);
      const wasManuallyDeselected = manuallyDeselectedRows.includes(record.idx);
      const isEmptyRow = Object.values(record).every((value) => value === "");

      if (isSelected) {
        console.log(`Row ${record.idx} is highlighted as selected`);
        // Prioritize manual selection over auto-selection for styling
        if (isManuallySelected) {
          return "selected-row"; // Blue highlighting for manual selection
        } else if (isAutoSelected) {
          return "auto-selected-row"; // Green highlighting for auto-selection only
        }
        return "selected-row"; // Default to manual selection styling
      }
      if (wasManuallyDeselected) {
        return "manually-deselected-row"; // Gray with dashed border - can be restored
      }
      if (isEmptyRow) {
        return "empty-row";
      }
      return "";
    },
    [
      selectedRows,
      externalSelectedRows,
      manuallySelectedRows,
      manuallyDeselectedRows,
    ]
  );

  // Function to navigate to a specific row by ID
  const navigateToRow = useCallback((rowId: string) => {
    if (!tableWrapperRef.current) {
      return;
    }

    setTimeout(() => {
      // Try multiple selectors to find the row
      const rowElement =
        (tableWrapperRef.current?.querySelector(
          `tr[data-row-key="${rowId}"]`
        ) as HTMLElement) ||
        (tableWrapperRef.current?.querySelector(
          `.ant-table-tbody tr[data-row-key="${rowId}"]`
        ) as HTMLElement) ||
        (tableWrapperRef.current?.querySelector(
          `.consistent-height-table tr[data-row-key="${rowId}"]`
        ) as HTMLElement);

      if (rowElement) {
        // Find the scrollable container (Ant Design table body)
        const scrollContainer = tableWrapperRef.current?.querySelector(
          ".ant-table-body"
        ) as HTMLElement;

        if (scrollContainer) {
          // Calculate the position relative to the scroll container
          const rowRect = rowElement.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          const scrollTop =
            scrollContainer.scrollTop +
            (rowRect.top - containerRect.top) -
            containerRect.height / 2 +
            rowRect.height / 2;

          scrollContainer.scrollTo({
            top: scrollTop,
            behavior: "smooth",
          });
        } else {
          // Fallback to scrollIntoView if scroll container not found
          rowElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    }, 100);
  }, []);

  // Navigate to next selected row
  const navigateToNext = useCallback(() => {
    if (selectedRows.length === 0) return;

    // If at initial state (-1), go to first row (index 0)
    const nextIndex =
      currentNavigationIndex < 0
        ? 0
        : currentNavigationIndex < selectedRows.length - 1
        ? currentNavigationIndex + 1
        : currentNavigationIndex; // Don't wrap, stay at last
    setCurrentNavigationIndex(nextIndex);
    navigateToRow(selectedRows[nextIndex]);
  }, [selectedRows, currentNavigationIndex, navigateToRow]);

  // Navigate to previous selected row
  const navigateToPrevious = useCallback(() => {
    if (selectedRows.length === 0) return;

    // If at initial state (-1), go to last row
    const prevIndex =
      currentNavigationIndex < 0
        ? selectedRows.length - 1
        : currentNavigationIndex > 0
        ? currentNavigationIndex - 1
        : currentNavigationIndex; // Don't wrap, stay at first
    setCurrentNavigationIndex(prevIndex);
    navigateToRow(selectedRows[prevIndex]);
  }, [selectedRows, currentNavigationIndex, navigateToRow]);

  // Reset navigation index when selections change
  useEffect(() => {
    if (selectedRows.length === 0) {
      setCurrentNavigationIndex(-1);
    } else if (
      currentNavigationIndex < 0 ||
      currentNavigationIndex >= selectedRows.length
    ) {
      // Initialize to first row (index 0) when selections are made
      setCurrentNavigationIndex(0);
      // Auto-navigate to first selected row
      if (selectedRows.length > 0) {
        navigateToRow(selectedRows[0]);
      }
    }
  }, [
    selectedRows.length,
    currentNavigationIndex,
    selectedRows,
    navigateToRow,
  ]);

  return (
    <div ref={tableWrapperRef}>
      {/* Search Input and Navigation */}
      <div
        style={{
          margin: "8px",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <Input
          placeholder={
            fileType === 1
              ? "Search in CBL table..."
              : "Search in Insurer table..."
          }
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          allowClear
          style={{
            maxWidth: "300px",
          }}
        />
        {selectedRows.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Tooltip title="Navigate to previous selected row">
                <Button
                  type="default"
                  icon={<UpOutlined />}
                  size="small"
                  onClick={navigateToPrevious}
                  disabled={
                    selectedRows.length === 0 ||
                    (currentNavigationIndex >= 0 &&
                      currentNavigationIndex === 0)
                  }
                />
              </Tooltip>
              <Tooltip
                title={`${selectedRows.length} selected row${
                  selectedRows.length > 1 ? "s" : ""
                }`}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    padding: "0 8px",
                    minWidth: "60px",
                    textAlign: "center",
                  }}
                >
                  {currentNavigationIndex >= 0
                    ? `${currentNavigationIndex + 1}/${selectedRows.length}`
                    : `1/${selectedRows.length}`}
                </span>
              </Tooltip>
              <Tooltip title="Navigate to next selected row">
                <Button
                  type="default"
                  icon={<DownOutlined />}
                  size="small"
                  onClick={navigateToNext}
                  disabled={
                    selectedRows.length === 0 ||
                    (currentNavigationIndex >= 0 &&
                      currentNavigationIndex === selectedRows.length - 1)
                  }
                />
              </Tooltip>
            </div>
            <Tooltip title="Subtotal of selected rows">
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#1890ff",
                  padding: "4px 12px",
                  backgroundColor: "#e6f7ff",
                  borderRadius: "4px",
                  border: "1px solid #91d5ff",
                }}
              >
                Subtotal: Rs{" "}
                {selectedRowsSubtotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </Tooltip>
          </>
        )}
        {searchText && (
          <span
            style={{
              marginLeft: "8px",
              fontSize: "12px",
              color: "#666",
            }}
          >
            Showing {filteredData.length} of {data.length} rows
          </span>
        )}
      </div>

      {hiddenColumns.size > 0 && (
        <div
          style={{
            margin: "8px",
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "12px", color: "#666", marginRight: "8px" }}>
            Hidden columns:
          </span>
          {Array.from(hiddenColumns).map((columnKey) => {
            const hiddenCol = columns.find((col: any) => col.key === columnKey);
            return (
              <Button
                key={columnKey}
                type="dashed"
                size="small"
                onClick={() => {
                  const newHiddenColumns = new Set(hiddenColumns);
                  newHiddenColumns.delete(columnKey);
                  setHiddenColumns(newHiddenColumns);
                }}
                style={{ fontSize: "11px", height: "22px", padding: "0 6px" }}
              >
                Show "{hiddenCol?.title || columnKey}"
              </Button>
            );
          })}
        </div>
      )}
      <Table
        columns={resizableColumns}
        dataSource={filteredData}
        rowKey="idx"
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        scroll={{ x: "max-content", y: 600 }}
        size="small"
        bordered
        className="consistent-height-table"
        rowClassName={getRowClassName}
        onRow={(row) => ({
          onClick: () => handleRowClicked(row),
        })}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100", "200", "500"],
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} items`,
          onChange: (page, size) => {
            handleCurrentPageChange(page);
            if (size !== pageSize) {
              handlePageSizeChange(size);
              handleCurrentPageChange(1); // Reset to first page when page size changes
            }
          },
          onShowSizeChange: (current, size) => {
            handlePageSizeChange(size);
            handleCurrentPageChange(1); // Reset to first page when page size changes
          },
        }}
        loading={loading}
      />
    </div>
  );
}

export default MatchableDataTable;
