import React, { useMemo } from "react";
import DataTable, { TableColumn } from "react-data-table-component";
import styles from "./Reconciliation.module.scss";

type Props = {
  data: any[];
  handleRowClicked?: (row: any, event?: React.MouseEvent) => void;
  conditionalRowStyles?: any;
  filterText: string;
};

function Datatable({
  data,
  handleRowClicked,
  conditionalRowStyles,
  filterText,
}: Props) {
  const filteredItems = useMemo(() => {
    if (!filterText) return data;

    return data.filter((item) => {
      return Object.values(item).some((value) => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(filterText.toLowerCase());
      });
    });
  }, [data, filterText]);

  const defaultConditionalRowStyles = [
    {
      when: (row: any) => row.match_condition === "match",
      style: {
        backgroundColor: "#e6f4ea", // a very soft greenish tint
        color: "#2e7d32", // deep green for text (not harsh)
        fontWeight: "500",
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
        backgroundColor: "#e8f0fe", // subtle, soft blue (like Google's highlight blue)
        color: "#1a73e8", // modern blue text
        fontWeight: "500",
      },
    },
    {
      when: (row: any) =>
        row.match_condition === "manual match" && row.match_group % 2 === 1,
      style: {
        backgroundColor: "#e0e0e0", // light gray
        color: "#333333",
        fontWeight: "500",
      },
    },
    {
      when: (row: any) =>
        row.match_condition === "manual match" && row.match_group % 2 === 0,
      style: {
        backgroundColor: "#9e9e9e", // dark gray
        color: "#ffffff",
        fontWeight: "500",
      },
    },
  ];

  const columns: TableColumn<any>[] = data.length
    ? Object.keys(data[0])
        .filter(
          (key) =>
            key !== "row_id_1" &&
            key !== "row_id_2" &&
            key !== "match_condition" &&
            key !== "match_group"
        )
        .map((key) => ({
          name: key,
          selector: (row) => row[key],
          cell: (row) => {
            // Style for placing no partial matches
            const isPlacingNoPartial =
              row.match_condition === "placing no partial";
            const shouldHighlight =
              isPlacingNoPartial &&
              (key === "Placing No." || key === "Premiun");

            const style = shouldHighlight
              ? {
                  color: "#d32f2f",
                  fontWeight: "500",
                }
              : {};

            return (
              <div
                className={styles["cell-content"]}
                title={row[key]}
                style={style}
              >
                {row[key]}
              </div>
            );
          },
          minWidth: "120px",
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
          data={filteredItems}
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
