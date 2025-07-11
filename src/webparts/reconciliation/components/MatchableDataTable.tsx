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
        console.log("row", amount);
        console.log("total", acc + amount);
        return acc + amount;
      }, 0);
      onSumChange(total);
    } else if (fileType === 2) {
      const total = selectedData.reduce((acc, row) => {
        const amount = isNaN(row[insuranceColumnMappings.amount])
          ? 0
          : row[insuranceColumnMappings.amount];
        return acc + amount;
      }, 0);
      onSumChange(total);
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
    const isEmptyRow = Object.values(row).every((value) => value === "");

    // If the row is empty, don't allow selection
    if (isEmptyRow) {
      return;
    }

    // Toggle selection
    setSelectedRows((prev) => {
      if (prev.includes(row.row_id_1)) {
        return prev.filter((id) => id !== row.row_id_1);
      } else {
        return [...prev, row.row_id_1];
      }
    });

    if (setSelectedRowData) {
      setSelectedRowData((prev) => {
        if (prev.some((r) => r.row_id_1 === row.row_id_1)) {
          return prev.filter((r) => r.row_id_1 !== row.row_id_1);
        } else {
          return [...prev, { ...row, match_condition: "manual match" }];
        }
      });
    }
  };

  const conditionalRowStyles = [
    {
      when: (row: any) => selectedRows.includes(row.row_id_1),
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
