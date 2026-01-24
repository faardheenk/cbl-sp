export const filterData = (postfix: string, data: any[]): any[] => {
  return data.map((row, index) => {
    const filtered: Record<string, any> = {};

    filtered["idx"] = "NM-" + index;

    for (const key in row) {
      if (key.endsWith(postfix)) {
        const cleanKey = key.replace(postfix, "");
        filtered[cleanKey] = row[key];
      }
    }

    return filtered;
  });
};

export const regenerateIdx = (
  data: any[],
  type: "exact" | "partial" | "no-match" = "no-match",
): any[] => {
  return data.map((row, index) => {
    const prefix =
      type === "exact" ? "EM-" : type === "partial" ? "PM-" : "NM-";
    row["idx"] = prefix + index;
    return row;
  });
};

export const splitData = (
  data: any[],
  group: string,
): { cbl: any[]; insurer: any[] } => {
  const cbl: any[] = [];
  const insurer: any[] = [];

  data.forEach((row, index) => {
    const cblRow: Record<string, any> = {};
    const insurerRow: Record<string, any> = {};

    for (const key in row) {
      if (key.endsWith("_INSURER")) {
        // Remove the _insurer postfix for the insurer object
        const cleanKey = key.replace("_INSURER", "");
        insurerRow[cleanKey] = row[key];
        insurerRow["idx"] = group === "exact" ? "EM-" + index : "PM-" + index;
      } else {
        // Keep original key for CBL object
        cblRow[key] = row[key];
        cblRow["idx"] = group === "exact" ? "EM-" + index : "PM-" + index;
      }
    }

    cbl.push(cblRow);
    insurer.push(insurerRow);
  });

  return { cbl, insurer };
};

export const mergeData = (cbl: any[], insurer: any[]): any[] => {
  return cbl.map((cblRow, index) => {
    const insurerRow = insurer.find(
      (insurerRow) =>
        insurerRow.idx ===
        (cblRow.idx.startsWith("EM-")
          ? "EM-" + index
          : cblRow.idx.startsWith("PM-")
            ? "PM-" + index
            : "NM-" + index),
    );

    // Add insurance name as postfix to insurer properties
    const insurerWithPostfix: Record<string, any> = {};
    if (insurerRow) {
      for (const key in insurerRow) {
        if (key !== "idx") {
          // Don't add postfix to idx, replace empty/whitespace strings with 0
          const value =
            typeof insurerRow[key] === "string"
              ? insurerRow[key].trim()
              : insurerRow[key];
          insurerWithPostfix[`${key}_INSURER`] =
            value === "" ? 0 : insurerRow[key];
        } else {
          insurerWithPostfix[key] = insurerRow[key];
        }
      }
    }

    // Process CBL row to replace empty/whitespace strings with 0
    const processedCblRow: Record<string, any> = {};
    for (const key in cblRow) {
      const value =
        typeof cblRow[key] === "string" ? cblRow[key].trim() : cblRow[key];
      processedCblRow[key] = value === "" ? 0 : cblRow[key];
    }

    return { ...processedCblRow, ...insurerWithPostfix };
  });
};

export const addPostfix = (data: any[]): any[] => {
  return data.map((row, index) => {
    const filtered: Record<string, any> = {};
    row["idx"] = "NM-" + index;

    for (const key in row) {
      if (key !== "idx") {
        filtered[`${key}_INSURER`] = row[key];
      } else {
        filtered[key] = row[key];
      }
    }
    return filtered;
  });
};
