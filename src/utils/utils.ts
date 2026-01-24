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

  const sum1 = ws1.reduce((acc, row) => {
    const amount = isNaN(row.ProcessedAmount) ? 0 : Number(row.ProcessedAmount);
    return acc + amount;
  }, 0);

  const sum2 = ws2.reduce((acc, row) => {
    const amount = isNaN(row.ProcessedAmount) ? 0 : Number(row.ProcessedAmount);
    return acc + amount;
  }, 0);


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
  noMatchCBL?: any[],
  // NEW PARAMETERS:
  deselectedCBLRows?: string[],           // Array of CBL row IDs that were deselected
  deselectedInsurerRows?: string[],       // Array of Insurer row IDs that were deselected
  allCBLRowsInGroups?: string[],          // All CBL rows in selected groups (full context)
  allInsurerRowsInGroups?: string[]       // All Insurer rows in selected groups (full context)
) => {
  const rowsToRemoveCBL = new Set<number>();
  const rowsToRemoveInsurer = new Set<number>();
  const removedInsurerRows: any[] = [];
  const exactMatchInsurerRows: any[] = [];
  const noMatchInsurerRows: any[] = [];
  let cblMatchedIndices = 0;

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
      exactMatchCBLRows: selectedRowsCBL, // Selected CBL rows to move to exact
      exactMatchInsurerRows: selectedRowsInsurer, // Selected Insurer rows to move to exact
      updatedNoMatchInsurer: noMatchInsurer, // Will be updated in calling function
      updatedNoMatchCBL: noMatchCBL, // No changes for no-match CBL
    };
  } else {
    // Handle partial match to exact match conversion (existing logic)
    // ============================================
    // PHASE 2: Filter Orphaned Deselected Rows
    // ============================================
    const deselectedCBLSet = new Set(deselectedCBLRows || []);
    const deselectedInsurerSet = new Set(deselectedInsurerRows || []);

    // Determine deselection type first
    const hasCBLDeselections = deselectedCBLRows && deselectedCBLRows.length > 0;
    const hasInsurerDeselections = deselectedInsurerRows && deselectedInsurerRows.length > 0;
    const isBalanced = hasCBLDeselections && hasInsurerDeselections;
    const isCBLOnly = hasCBLDeselections && !hasInsurerDeselections;
    const isInsurerOnly = !hasCBLDeselections && hasInsurerDeselections;

    // Filter out orphaned deselected rows (one-sided only)
    // Balanced deselected rows are NOT filtered - they stay in partial
    let filteredRowsCBL = rowsCBL;
    let filteredRowsInsurer = rowsInsurer;

    if (isCBLOnly) {
      // Filter out orphaned CBL deselected rows
      filteredRowsCBL = rowsCBL.filter(
        (row) => !deselectedCBLSet.has(row.idx)
      );
    }

    if (isInsurerOnly) {
      // Filter out orphaned Insurer deselected rows
      filteredRowsInsurer = rowsInsurer.filter(
        (row) => !deselectedInsurerSet.has(row.idx)
      );
    }

    // Always filter deselected rows from selected arrays (they shouldn't be selected)
    const filteredSelectedRowsCBL = selectedRowsCBL.filter(
      (row) => !deselectedCBLSet.has(row.idx)
    );
    const filteredSelectedRowsInsurer = selectedRowsInsurer.filter(
      (row) => !deselectedInsurerSet.has(row.idx)
    );

    // ============================================
    // PHASE 4: Handle Orphaned Rows
    // ============================================
    const orphanedCBLRows: any[] = [];
    const orphanedInsurerRows: any[] = [];

    if (isCBLOnly) {
      // Find deselected CBL rows in the original array
      deselectedCBLRows!.forEach((deselectedIdx) => {
        const row = rowsCBL.find((r) => r.idx === deselectedIdx);
        if (row) {
          orphanedCBLRows.push(row);
        }
      });
      
      // Console log orphaned CBL rows
      if (orphanedCBLRows.length > 0) {
        console.log("[Orphaned CBL Rows]", orphanedCBLRows);
      }
    }

    if (isInsurerOnly) {
      // Find deselected Insurer rows in the original array
      deselectedInsurerRows!.forEach((deselectedIdx) => {
        const row = rowsInsurer.find((r) => r.idx === deselectedIdx);
        if (row) {
          orphanedInsurerRows.push(row);
        }
      });
      
      // Console log orphaned Insurer rows
      if (orphanedInsurerRows.length > 0) {
        console.log("[Orphaned Insurer Rows]", orphanedInsurerRows);
      }
    }
    
    // Log if no orphaned rows
    if (orphanedCBLRows.length === 0 && orphanedInsurerRows.length === 0) {
      console.log("[Orphaned Rows] None");
    }

    // Build a set of selected CBL row indices for quick lookup
    const selectedCBLIndices = new Set(
      filteredSelectedRowsCBL.map((row) => row.idx)
    );

    // Remove CBL rows - ONLY rows that are actually selected (use filtered selected rows)
    filteredSelectedRowsCBL.forEach((selectedRow) => {
      const selectedIndex = filteredRowsCBL.findIndex(
        (row) => row["idx"] === selectedRow["idx"]
      );

      if (selectedIndex !== -1) {
        rowsToRemoveCBL.add(selectedIndex);
        const row = filteredRowsCBL[selectedIndex];

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
                if (nextIndex < filteredRowsCBL.length) {
                  const nextRow = filteredRowsCBL[nextIndex];
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

    if (filteredSelectedRowsCBL.length === filteredSelectedRowsInsurer.length) {
      // For each pair, check matched_insurer_indices from CBL row
      for (let i = 0; i < filteredSelectedRowsCBL.length; i++) {
        const cblRow = filteredSelectedRowsCBL[i];
        const insurerRow = filteredSelectedRowsInsurer[i];
        const insurerIndex = filteredRowsInsurer.findIndex(
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
            exactMatchInsurerRows.push(filteredRowsInsurer[insurerIndex]);
          }
          // Move the next (matchedIndices.length - 1) rows after the selected insurer row to no match insurer
          for (let j = 1; j < matchedIndices.length; j++) {
            const nextIndex = insurerIndex + j;
            if (nextIndex < filteredRowsInsurer.length) {
              rowsToRemoveInsurer.add(nextIndex);
              noMatchInsurerRows.push(filteredRowsInsurer[nextIndex]);
            }
          }
        } else {
          // If matched indices length matches, treat as normal exact match
          // CRITICAL FIX: Only remove insurer rows that are actually selected
          if (insurerIndex !== -1) {
            const selectedInsurerIndices = new Set(
              filteredSelectedRowsInsurer.map((row) => row.idx)
            );
            for (let j = 0; j < n; j++) {
              const idxToRemove = insurerIndex + j;
              if (idxToRemove < filteredRowsInsurer.length) {
                const insurerRow = filteredRowsInsurer[idxToRemove];
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
      filteredSelectedRowsCBL.forEach((cblRow) => {
        if (cblRow.matched_insurer_indices) {
          try {
            const matchedIndices = JSON.parse(cblRow.matched_insurer_indices);
            if (Array.isArray(matchedIndices)) {
              // Find the first selected insurer row to get the starting position
              const firstSelectedInsurerRow = filteredSelectedRowsInsurer[0];
              const insurerIndex = filteredRowsInsurer.findIndex(
                (row) => row["idx"] === firstSelectedInsurerRow["idx"]
              );

              if (insurerIndex !== -1) {
                // Move selected insurer rows to exact match
                filteredSelectedRowsInsurer.forEach((insurerRow) => {
                  const selectedInsurerIndex = filteredRowsInsurer.findIndex(
                    (row) => row["idx"] === insurerRow["idx"]
                  );
                  if (selectedInsurerIndex !== -1) {
                    rowsToRemoveInsurer.add(selectedInsurerIndex);
                    exactMatchInsurerRows.push(
                      filteredRowsInsurer[selectedInsurerIndex]
                    );
                  }
                });

                // Move the remaining insurer rows from the same partial match group to no match
                // Use array positions: insurerIndex + 1, insurerIndex + 2, ..., insurerIndex + (matchedIndices.length - 1)
                for (let j = 1; j < matchedIndices.length; j++) {
                  const nextIndex = insurerIndex + j;
                  if (nextIndex < filteredRowsInsurer.length) {
                    // Check if this row is not already selected
                    const isSelected = filteredSelectedRowsInsurer.some(
                      (selectedRow) =>
                        selectedRow["idx"] === filteredRowsInsurer[nextIndex]["idx"]
                    );
                    if (!isSelected) {
                      rowsToRemoveInsurer.add(nextIndex);
                      noMatchInsurerRows.push(filteredRowsInsurer[nextIndex]);
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

    // ============================================
    // PHASE 5: Separate Selected vs Deselected vs Remaining Rows
    // ============================================
    // Rows to move to exact match (selected rows that were removed)
    // Get the actual row objects from filteredRowsCBL based on indices in rowsToRemoveCBL
    const exactMatchCBLRows = filteredRowsCBL.filter(
      (row, index) => rowsToRemoveCBL.has(index)
    );

    // Console log CBL rows moving to exact match
    if (exactMatchCBLRows.length > 0) {
    } else {
    }

    // Console log Insurer rows moving to exact match
    if (exactMatchInsurerRows.length > 0) {
    } else {
    }

    // Rows staying in partial:
    // - Balanced deselected rows (both sides deselected)
    // - Non-selected, non-deselected rows
    const remainingPartialCBLRows = filteredRowsCBL.filter(
      (row, index) => !rowsToRemoveCBL.has(index) // Not selected (includes deselected and non-selected)
    );
    const remainingPartialInsurerRows = filteredRowsInsurer.filter(
      (row, index) => !rowsToRemoveInsurer.has(index) // Not selected (includes deselected and non-selected)
    );

    // ============================================
    // PHASE 5: Repair matched_insurer_indices for Balanced Deselected Rows
    // ============================================
    if (isBalanced && remainingPartialCBLRows.length > 0) {
      // Group remaining CBL rows by their original matched_insurer_indices or group_id
      const groupToCBLRows = new Map<string, any[]>();
      
      remainingPartialCBLRows.forEach((cblRow) => {
        // Use group_id if available, otherwise use matched_insurer_indices as group key
        const groupKey = cblRow.group_id || cblRow.matched_insurer_indices || 'default';
        if (!groupToCBLRows.has(groupKey)) {
          groupToCBLRows.set(groupKey, []);
        }
        groupToCBLRows.get(groupKey)!.push(cblRow);
      });
      
      // For each group, find corresponding remaining insurer rows
      groupToCBLRows.forEach((cblRows, groupKey) => {
        // Get the first CBL row's original matched_insurer_indices to understand the group
        const firstCBLRow = cblRows[0];
        let originalMatchedIndices: number[] = [];
        if (firstCBLRow.matched_insurer_indices) {
          try {
            originalMatchedIndices = JSON.parse(firstCBLRow.matched_insurer_indices);
          } catch (e) {
            console.warn("Failed to parse matched_insurer_indices:", e);
          }
        }
        
        // Find corresponding insurer rows that are also staying in partial
        // For balanced deselections, we need to count how many insurer rows remain in this group
        // This is a simplified approach - ideally we'd use allInsurerRowsInGroups context for precise mapping
        
        // Calculate remaining insurer count for this group
        // Original count minus deselected count (if they're from this group)
        let remainingInsurerCount = originalMatchedIndices.length;
        
        // If we have context about all insurer rows in groups, use it
        if (allInsurerRowsInGroups && allInsurerRowsInGroups.length > 0) {
          // Count how many insurer rows from this group are staying in partial
          // This is a placeholder - needs proper group matching logic
          remainingInsurerCount = Math.max(
            1, // At least 1 (the deselected one stays in balanced case)
            originalMatchedIndices.length
          );
        } else {
          // Simplified: For balanced deselections, assume 1:1 relationship for remaining rows
          // This is a heuristic - may need refinement
          remainingInsurerCount = Math.max(
            1, // At least 1 insurer row remains (the deselected one)
            originalMatchedIndices.length - (deselectedInsurerRows?.length || 0) + 1
          );
        }
        
        // Update matched_insurer_indices for all CBL rows in this group
        const newMatchedIndices = Array.from({ length: remainingInsurerCount }, (_, i) => i);
        cblRows.forEach((cblRow) => {
          cblRow.matched_insurer_indices = JSON.stringify(newMatchedIndices);
        });
      });
    }

    const uniqueExactMatchInsurerRows = Array.from(
      new Map(exactMatchInsurerRows.map((row) => [row.idx, row])).values(),
    );

    // Add orphaned rows to no-match
    const updatedNoMatchCBL = orphanedCBLRows.length > 0 
      ? [...(noMatchCBL || []), ...orphanedCBLRows]
      : noMatchCBL;
    const updatedNoMatchInsurer = [...noMatchInsurer, ...noMatchInsurerRows, ...orphanedInsurerRows];

    // Final summary log

    return {
      updatedRowsCBL: remainingPartialCBLRows, // Rows staying in partial (with repaired indices if balanced)
      updatedRowsInsurer: remainingPartialInsurerRows,
      exactMatchCBLRows, // Selected CBL rows to move to exact
      exactMatchInsurerRows: uniqueExactMatchInsurerRows, // Selected Insurer rows to move to exact
      updatedNoMatchInsurer,
      updatedNoMatchCBL, // For orphaned CBL rows
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
