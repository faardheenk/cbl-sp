import React, { useState } from "react";

import Datatable from "./Datatable";

type Props = {
  partialMatches: any[];
  setPartialMatchesSetter: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedRowData?: React.Dispatch<React.SetStateAction<any>>;
};

function PartialMatch({
  partialMatches,
  setPartialMatchesSetter,
  setSelectedRowData,
}: Props) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const handleRowClicked = (row: any) => {
    console.log("Row clicked:", row.row_id_1);
    setSelectedRow(row.row_id_1);
    // setSelectedRowData && setSelectedRowData(row);

    if (setSelectedRowData) setSelectedRowData(row);
    // setPartialMatchesSetter(row);
  };

  const conditionalRowStyles = [
    {
      when: (row: any) => row.row_id_1 === selectedRow,
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
