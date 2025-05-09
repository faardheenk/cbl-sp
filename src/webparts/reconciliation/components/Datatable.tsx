import React from "react";
import DataTable, { TableColumn } from "react-data-table-component";
import styles from "./Reconciliation.module.scss";

type Props = {
  data: any[];
  handleRowClicked?: (row: any, event?: React.MouseEvent) => void;
  conditionalRowStyles?: any;
};

function Datatable({ data, handleRowClicked, conditionalRowStyles }: Props) {
  const defaultConditionalRowStyles = [
    {
      when: (row: any) => row.match_condition === "match",
      style: {
        backgroundColor: "#e6ffe6",
      },
    },
    {
      when: (row: any) => row.match_condition === "mismatch",
      style: {
        backgroundColor: "#ffe6e6",
      },
    },
    {
      when: (row: any) => row.match_condition === "pre-matched",
      style: {
        backgroundColor: "#fff2e6",
      },
    },
    {
      when: (row: any) => row.match_condition === "manual match",
      style: {
        color: "#ff0000",
      },
    },
  ];

  const columns: TableColumn<any>[] = data.length
    ? Object.keys(data[0])
        .filter(
          (key) =>
            key !== "row_id_1" &&
            key !== "row_id_2" &&
            key !== "match_condition"
        )
        .map((key) => ({
          name: key,
          selector: (row) => row[key],
          cell: (row) => (
            <div className={styles["cell-content"]} title={row[key]}>
              {row[key]}
            </div>
          ),
          minWidth: "120px", // Set minimum width
        }))
    : [];

  const customStyles = {
    headCells: {
      style: {
        paddingLeft: "1rem",
        paddingRight: "1rem",
      },
    },
    cells: {
      style: {
        paddingLeft: "1rem",
        paddingRight: "1rem",
      },
    },
  };

  return (
    <>
      {data.length > 0 ? (
        <DataTable
          columns={columns}
          data={data}
          pagination
          pointerOnHover
          responsive
          fixedHeader
          fixedHeaderScrollHeight="calc(100% - 56px)"
          customStyles={customStyles}
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
          {...(handleRowClicked && { onRowClicked: handleRowClicked })}
          conditionalRowStyles={
            conditionalRowStyles || defaultConditionalRowStyles
          }
        />
      ) : (
        <div className={styles["empty-state"]}>
          <h4>No data available</h4>
          <p>There are no records to display</p>
        </div>
      )}
    </>
  );
}

export default Datatable;
