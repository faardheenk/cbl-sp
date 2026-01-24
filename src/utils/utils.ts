import { ColumnsType } from "antd/es/table";

export const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const convertToTableColumns = (columnNames: string[]): ColumnsType => {
  return columnNames.map((columnName) => ({
    title: columnName,
    dataIndex: columnName,
    key: columnName,
  }));
};

export const countNonBlankRows = (rows: any[]) => {
  return rows.filter((row) => {
    const amount = row.ProcessedAmount;
    return amount !== undefined && amount !== null && amount !== "";
  }).length;
};

// Create a template for blank rows based on the existing data structure
export const createBlankRow = (template: any, nextMatchGroup: number) => {
  return Object.keys(template || {}).reduce((acc, key) => {
    acc[key] = "";
    acc["match_condition"] = "manual match";
    acc["match_group"] = nextMatchGroup.toString();
    return acc;
  }, {} as Record<string, string>);
};

export const calculateSum = (ws1: any[], ws2: any[]) => {
  // console.log("ws1 >", ws1);
  // console.log("ws2 >", ws2);
  // console.log("cblColumnMappings >", cblColumnMappings);
  // console.log("insuranceColumnMappings >", insuranceColumnMappings);

  const sum1 = ws1.reduce((acc, row) => {
    const amount = isNaN(row.ProcessedAmount) ? 0 : Number(row.ProcessedAmount);
    return acc + amount;
  }, 0);

  const sum2 = ws2.reduce((acc, row) => {
    const amount = isNaN(row.ProcessedAmount) ? 0 : Number(row.ProcessedAmount);
    return acc + amount;
  }, 0);

  // console.log("sum 1 >", sum1);
  // console.log("sum 2 >", sum2);

  return { sum1, sum2 };
};

export const clearSelectedRows = (
  rows: any[],
  selectedRows: any[],
  idKey: string
) => {
  const rowsToRemove = new Set<number>();

  // First, identify all rows that need to be removed
  selectedRows.forEach((selectedRow) => {
    const selectedIndex = rows.findIndex(
      (row) => row[idKey] === selectedRow[idKey]
    );

    console.log("selectedIndex >>> ", selectedIndex);

    if (selectedIndex !== -1) {
      // Add the selected row to removal set
      rowsToRemove.add(selectedIndex);

      // Check if the selected row has matched_insurer_indices property
      const row = rows[selectedIndex];
      if (row.matched_insurer_indices) {
        try {
          // Parse the matched_insurer_indices as JSON to get an array
          const matchedIndices = JSON.parse(row.matched_insurer_indices);

          // If it's an array, add the next N rows to removal set
          if (Array.isArray(matchedIndices)) {
            const additionalRowsToRemove = matchedIndices.length - 1;

            // Add the next N rows after the selected row
            for (let i = 1; i <= additionalRowsToRemove; i++) {
              const nextIndex = selectedIndex + i;
              if (nextIndex < rows.length) {
                rowsToRemove.add(nextIndex);
              }
            }
          }
        } catch (error) {
          // If JSON parsing fails, just remove the selected row
          console.warn("Failed to parse matched_insurer_indices:", error);
        }
      }
    }
  });

  // Filter out all identified rows
  return rows.filter((_, index) => !rowsToRemove.has(index));
};

export const manualMatching = (
  rowsCBL: any[],
  rowsInsurer: any[],
  selectedRowsCBL: any[],
  selectedRowsInsurer: any[],
  noMatchInsurer: any[],
  noMatchCBL?: any[]
) => {
  const rowsToRemoveCBL = new Set<number>();
  const rowsToRemoveInsurer = new Set<number>();
  const removedInsurerRows: any[] = [];
  const exactMatchInsurerRows: any[] = [];
  const noMatchInsurerRows: any[] = [];
  let cblMatchedIndices = 0;

  console.log("selectedRowsCBL  from utils >>> ", selectedRowsCBL);
  console.log("selectedRowsInsurer >>> ", selectedRowsInsurer);

  // Check if selected rows are from no match section
  const isFromNoMatch =
    noMatchCBL &&
    noMatchCBL.length > 0 &&
    selectedRowsCBL.length > 0 &&
    selectedRowsCBL.some((selectedRow) =>
      noMatchCBL.some((noMatchRow) => noMatchRow["idx"] === selectedRow["idx"])
    );

  if (isFromNoMatch) {
    // Handle no match to exact match conversion
    console.log("Processing no match to exact match conversion");

    // Remove selected CBL rows from no match
    selectedRowsCBL.forEach((selectedRow) => {
      const selectedIndex = noMatchCBL.findIndex(
        (row) => row["idx"] === selectedRow["idx"]
      );
      if (selectedIndex !== -1) {
        // Note: We don't add to rowsToRemoveCBL here since we're working with noMatchCBL
        // The removal will be handled separately in the calling function
      }
    });

    // Remove selected insurer rows from no match
    selectedRowsInsurer.forEach((selectedRow) => {
      const selectedIndex = noMatchInsurer.findIndex(
        (row) => row["idx"] === selectedRow["idx"]
      );
      if (selectedIndex !== -1) {
        // Note: We don't add to rowsToRemoveInsurer here since we're working with noMatchInsurer
        // The removal will be handled separately in the calling function
      }
    });

    // For no match conversion, all selected rows go to exact match
    exactMatchInsurerRows.push(...selectedRowsInsurer);

    return {
      updatedRowsCBL: rowsCBL, // No changes to partial match CBL
      updatedRowsInsurer: rowsInsurer, // No changes to partial match insurer
      updatedNoMatchInsurer: noMatchInsurer, // Will be updated in calling function
    };
  } else {
    // Handle partial match to exact match conversion (existing logic)
    console.log("Processing partial match to exact match conversion");

    // Build a set of selected CBL row indices for quick lookup
    const selectedCBLIndices = new Set(
      selectedRowsCBL.map((row) => row.idx)
    );

    // Remove CBL rows - ONLY rows that are actually selected
    selectedRowsCBL.forEach((selectedRow) => {
      const selectedIndex = rowsCBL.findIndex(
        (row) => row["idx"] === selectedRow["idx"]
      );

      if (selectedIndex !== -1) {
        rowsToRemoveCBL.add(selectedIndex);
        const row = rowsCBL[selectedIndex];

        // CRITICAL FIX: Only remove adjacent rows if they are also selected
        // This prevents removing unselected rows that were auto-selected by group_id
        if (row.matched_insurer_indices) {
          try {
            const matchedIndices = JSON.parse(row.matched_insurer_indices);
            cblMatchedIndices = matchedIndices.length;

            if (Array.isArray(matchedIndices)) {
              const additionalRowsToRemove = matchedIndices.length - 1;
              for (let i = 1; i <= additionalRowsToRemove; i++) {
                const nextIndex = selectedIndex + i;
                if (nextIndex < rowsCBL.length) {
                  const nextRow = rowsCBL[nextIndex];
                  // Only remove if this row is also in the selected set
                  if (selectedCBLIndices.has(nextRow.idx)) {
                    rowsToRemoveCBL.add(nextIndex);
                  }
                }
              }
            }
          } catch (error) {
            console.warn("Failed to parse matched_insurer_indices:", error);
          }
        }
      }
    });

    if (selectedRowsCBL.length === selectedRowsInsurer.length) {
      // For each pair, check matched_insurer_indices from CBL row
      for (let i = 0; i < selectedRowsCBL.length; i++) {
        const cblRow = selectedRowsCBL[i];
        const insurerRow = selectedRowsInsurer[i];
        const insurerIndex = rowsInsurer.findIndex(
          (row) => row["idx"] === insurerRow["idx"]
        );

        let n = 1;
        let matchedIndices: any[] = [];
        if (cblRow.matched_insurer_indices) {
          try {
            matchedIndices = JSON.parse(cblRow.matched_insurer_indices);
            if (Array.isArray(matchedIndices) && matchedIndices.length > 1) {
              n = matchedIndices.length;
            }
          } catch (error) {
            console.warn(
              "Failed to parse matched_insurer_indices from selectedRowCBL:",
              error
            );
          }
        }

        // If the number of matched indices does not equal the number of selected insurer rows, break partial match
        if (
          matchedIndices.length > 0 &&
          matchedIndices.length !== selectedRowsInsurer.length
        ) {
          // Move the current selected insurer row to exact match
          if (insurerIndex !== -1) {
            rowsToRemoveInsurer.add(insurerIndex);
            exactMatchInsurerRows.push(rowsInsurer[insurerIndex]);
          }
          // Move the next (matchedIndices.length - 1) rows after the selected insurer row to no match insurer
          for (let j = 1; j < matchedIndices.length; j++) {
            const nextIndex = insurerIndex + j;
            if (nextIndex < rowsInsurer.length) {
              rowsToRemoveInsurer.add(nextIndex);
              noMatchInsurerRows.push(rowsInsurer[nextIndex]);
            }
          }
        } else {
          // If matched indices length matches, treat as normal exact match
          // CRITICAL FIX: Only remove insurer rows that are actually selected
          if (insurerIndex !== -1) {
            const selectedInsurerIndices = new Set(
              selectedRowsInsurer.map((row) => row.idx)
            );
            for (let j = 0; j < n; j++) {
              const idxToRemove = insurerIndex + j;
              if (idxToRemove < rowsInsurer.length) {
                const insurerRow = rowsInsurer[idxToRemove];
                // Only remove if this row is actually selected
                if (selectedInsurerIndices.has(insurerRow.idx)) {
                  rowsToRemoveInsurer.add(idxToRemove);
                  exactMatchInsurerRows.push(insurerRow);
                }
              }
            }
          }
        }
      }
    } else {
      // If not equal, move the selected insurer rows to exact match and remaining to no match
      selectedRowsCBL.forEach((cblRow) => {
        if (cblRow.matched_insurer_indices) {
          try {
            const matchedIndices = JSON.parse(cblRow.matched_insurer_indices);
            if (Array.isArray(matchedIndices)) {
              // Find the first selected insurer row to get the starting position
              const firstSelectedInsurerRow = selectedRowsInsurer[0];
              const insurerIndex = rowsInsurer.findIndex(
                (row) => row["idx"] === firstSelectedInsurerRow["idx"]
              );

              if (insurerIndex !== -1) {
                // Move selected insurer rows to exact match
                selectedRowsInsurer.forEach((insurerRow) => {
                  const selectedInsurerIndex = rowsInsurer.findIndex(
                    (row) => row["idx"] === insurerRow["idx"]
                  );
                  if (selectedInsurerIndex !== -1) {
                    rowsToRemoveInsurer.add(selectedInsurerIndex);
                    exactMatchInsurerRows.push(
                      rowsInsurer[selectedInsurerIndex]
                    );
                  }
                });

                // Move the remaining insurer rows from the same partial match group to no match
                // Use array positions: insurerIndex + 1, insurerIndex + 2, ..., insurerIndex + (matchedIndices.length - 1)
                for (let j = 1; j < matchedIndices.length; j++) {
                  const nextIndex = insurerIndex + j;
                  if (nextIndex < rowsInsurer.length) {
                    // Check if this row is not already selected
                    const isSelected = selectedRowsInsurer.some(
                      (selectedRow) =>
                        selectedRow["idx"] === rowsInsurer[nextIndex]["idx"]
                    );
                    if (!isSelected) {
                      rowsToRemoveInsurer.add(nextIndex);
                      noMatchInsurerRows.push(rowsInsurer[nextIndex]);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.warn(
              "Failed to parse matched_insurer_indices from selectedRowCBL:",
              error
            );
          }
        }
      });
    }

    const updatedRowsCBL = rowsCBL.filter(
      (_, index) => !rowsToRemoveCBL.has(index)
    );
    const updatedRowsInsurer = rowsInsurer.filter(
      (_, index) => !rowsToRemoveInsurer.has(index)
    );

    // Add any new no match insurer rows to the noMatchInsurer array
    const updatedNoMatchInsurer = [...noMatchInsurer, ...noMatchInsurerRows];

    return {
      updatedRowsCBL,
      updatedRowsInsurer,
      updatedNoMatchInsurer,
    };
  }
};

export const getNextMatchGroup = (worksheet1: any[], worksheet2: any[]) => {
  const lastGroup1 = worksheet1[worksheet1.length - 1]?.match_group || 0;
  const lastGroup2 = worksheet2[worksheet2.length - 1]?.match_group || 0;
  const lastMatchGroup = Math.max(lastGroup1, lastGroup2);
  return lastMatchGroup % 2 === 0 ? 1 : 2;
};

export const addGroupAndCondition = (rows: any[], matchGroup: number) => {
  return rows.map((row) => ({
    ...row,
    match_condition: "manual match",
    match_group: matchGroup,
  }));
};

export const equalizeWorksheetLengths = (
  ws1: any[],
  ws2: any[],
  matchGroup: number
) => {
  const diff = Math.abs(ws1.length - ws2.length);
  if (diff === 0) return [ws1, ws2];

  const shorter = ws1.length < ws2.length ? ws1 : ws2;
  const template = shorter[0] || {};
  const blankRows = Array(diff)
    .fill(null)
    .map(() => createBlankRow(template, matchGroup));

  return ws1.length < ws2.length
    ? [[...ws1, ...blankRows], ws2]
    : [ws1, [...ws2, ...blankRows]];
};

export const filterOutSelectedRows = (
  rows: any[],
  selectedRows: any[],
  idKey: string
) => {
  return rows.filter(
    (row) => !selectedRows.some((selected) => selected[idKey] === row[idKey])
  );
};
