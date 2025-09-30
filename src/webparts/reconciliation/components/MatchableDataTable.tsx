import React, { useState, useEffect, useCallback } from "react";
import { Table, Button, Tooltip } from "antd";
import { ColumnsType } from "antd/es/table";
import { Resizable, ResizeCallbackData } from "react-resizable";
import { EyeInvisibleOutlined } from "@ant-design/icons";
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
  externalSelectedRows?: string[];
  clearSelections?: boolean;
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
  externalSelectedRows = [],
  clearSelections = false,
}: Props) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [previousDataLength, setPreviousDataLength] = useState<number>(
    data.length
  );

  // Track which rows were auto-selected vs manually selected
  const [manuallySelectedRows, setManuallySelectedRows] = useState<string[]>(
    []
  );

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

  // console.log("cblColumnMappings", cblColumnMappings);
  // Calculate sum whenever selectedRows changes
  useEffect(() => {
    const selectedData = data.filter((row) =>
      selectedRows.includes(row.row_id_1)
    );

    if (fileType === 1) {
      const total = selectedData.reduce((acc, row) => {
        const amount = isNaN(row["processedAmount"])
          ? 0
          : row["processedAmount"];
        // console.log("row", amount);
        // console.log("total", acc + amount);
        return acc + amount;
      }, 0);
      // onSumChange(total);
    } else if (fileType === 2) {
      const total = selectedData.reduce((acc, row) => {
        const amount = isNaN(row["processedAmount"])
          ? 0
          : row["processedAmount"];
        return acc + amount;
      }, 0);
      // onSumChange(total);
    }
  }, [selectedRows, data, onSumChange, fileType]);

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

      // Check if this row was auto-selected
      const isAutoSelected = externalSelectedRows.includes(row.idx);

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
      } else if (!isAutoSelected) {
        // Add to manual selection (only if not auto-selected)
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
      externalSelectedRows,
      fileType,
      setSelectedRowData,
      onRowSelection,
      calculateTargetRowIndices,
    ]
  );

  // Function to determine row class name based on row state
  const getRowClassName = useCallback(
    (record: any) => {
      const isSelected = selectedRows.includes(record.idx);
      const isAutoSelected = externalSelectedRows.includes(record.idx);
      const isEmptyRow = Object.values(record).every((value) => value === "");

      if (isSelected) {
        console.log(`Row ${record.idx} is highlighted as selected`);
        if (isAutoSelected) {
          return "auto-selected-row";
        }
        return "selected-row";
      }
      if (isEmptyRow) {
        return "empty-row";
      }
      return "";
    },
    [selectedRows, externalSelectedRows]
  );

  return (
    <div>
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
        dataSource={data}
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        scroll={{ x: "max-content" }}
        size="small"
        bordered
        className="consistent-height-table"
        rowClassName={getRowClassName}
        onRow={(row) => ({
          onClick: () => handleRowClicked(row),
        })}
        pagination={{
          showSizeChanger: false,
        }}
      />
    </div>
  );
}

export default MatchableDataTable;
