import React, { useState } from "react";

import Datatable from "./Datatable";

type Props = {
  partialMatches: any[];
  setPartialMatchesSetter: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedRowData?: React.Dispatch<React.SetStateAction<any[]>>;
};

function PartialMatch({
  partialMatches,
  setPartialMatchesSetter,
  setSelectedRowData,
}: Props) {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  console.log("partialMatches", partialMatches);
  console.log("selectedRows", selectedRows);

  const handleRowClicked = (row: any) => {
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
  ];
  return (
    <Datatable
      data={partialMatches}
      handleRowClicked={handleRowClicked}
      conditionalRowStyles={conditionalRowStyles}
    />
  );
}

export default PartialMatch;
