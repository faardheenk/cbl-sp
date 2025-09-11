import React, { useState, useEffect } from "react";

import Datatable from "./Datatable";
import { ColumnMappingType } from "../../../typings";

type Props = {
  partialMatches: any[];
  setPartialMatchesSetter: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedRowData?: React.Dispatch<React.SetStateAction<any[]>>;
  fileType: 1 | 2;
  onSumChange: (sum: number) => void;
  cblColumnMappings: ColumnMappingType;
  insuranceColumnMappings: ColumnMappingType;
  filterText: string;
};

function MatchableDataTable({
  partialMatches,
  setPartialMatchesSetter,
  setSelectedRowData,
  fileType,
  onSumChange,
  cblColumnMappings,
  insuranceColumnMappings,
  filterText,
}: Props) {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [previousDataLength, setPreviousDataLength] = useState<number>(
    partialMatches.length
  );

  // Clear selected rows when data length decreases (indicating rows were removed)
  useEffect(() => {
    if (partialMatches.length < previousDataLength) {
      console.log(
        `Data length decreased from ${previousDataLength} to ${partialMatches.length}, clearing selections`
      );
      setSelectedRows([]);
      // Also clear the global selected row data
      if (setSelectedRowData) {
        setSelectedRowData([]);
      }
    }
    setPreviousDataLength(partialMatches.length);
  }, [partialMatches.length, previousDataLength, setSelectedRowData]);

  // console.log("cblColumnMappings", cblColumnMappings);
  // Calculate sum whenever selectedRows changes
  useEffect(() => {
    const selectedData = partialMatches.filter((row) =>
      selectedRows.includes(row.row_id_1)
    );

    if (fileType === 1) {
      const total = selectedData.reduce((acc, row) => {
        const amount = isNaN(row[cblColumnMappings.amount])
          ? 0
          : row[cblColumnMappings.amount];
        // console.log("row", amount);
        // console.log("total", acc + amount);
        return acc + amount;
      }, 0);
      // onSumChange(total);
    } else if (fileType === 2) {
      const total = selectedData.reduce((acc, row) => {
        const amount = isNaN(row[insuranceColumnMappings.amount])
          ? 0
          : row[insuranceColumnMappings.amount];
        return acc + amount;
      }, 0);
      // onSumChange(total);
    }
  }, [
    selectedRows,
    partialMatches,
    onSumChange,
    cblColumnMappings,
    insuranceColumnMappings,
    fileType,
  ]);

  // console.log("partialMatches", partialMatches);
  // console.log("selectedRows", selectedRows);

  const handleRowClicked = (row: any) => {
    // Check if the row is empty (all values are empty strings)
    // const isEmptyRow = Object.values(row).every((value) => value === "");
    const isEmptyRow = row.Amount === "";

    console.log("row clicked >>> ", row);
    console.log("current selectedRows >>> ", selectedRows);

    // If the row is empty, don't allow selection
    if (isEmptyRow) {
      return;
    }

    // Toggle selection
    setSelectedRows((prev) => {
      const newSelection = prev.includes(row.idx)
        ? prev.filter((id) => id !== row.idx)
        : [...prev, row.idx];
      console.log("new selection >>> ", newSelection);
      return newSelection;
    });

    if (setSelectedRowData) {
      setSelectedRowData((prev) => {
        if (prev.some((r) => r.idx === row.idx)) {
          return prev.filter((r) => r.idx !== row.idx);
        } else {
          return [...prev, { ...row, match_condition: "manual match" }];
        }
      });
    }
  };

  const conditionalRowStyles = [
    {
      when: (row: any) => {
        const isSelected = selectedRows.includes(row.idx);
        if (isSelected) {
          console.log(`Row ${row.idx} is highlighted as selected`);
        }
        return isSelected;
      },
      style: {
        backgroundColor: "rgba(68, 129, 221, 0.1)",
        userSelect: "none" as const,
      },
    },
    {
      when: (row: any) => Object.values(row).every((value) => value === ""),
      style: {
        backgroundColor: "#f5f5f5",
        opacity: "0.7",
      },
    },
  ];

  return (
    <Datatable
      data={partialMatches}
      handleRowClicked={handleRowClicked}
      conditionalRowStyles={conditionalRowStyles}
      filterText={filterText}
    />
  );
}

export default MatchableDataTable;
