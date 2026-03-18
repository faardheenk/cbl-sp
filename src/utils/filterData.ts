import { BucketKey, buildBucketRowId } from "./reconciliationBuckets";

export const filterData = (
  postfix: string,
  data: any[],
  bucketKey: BucketKey = "no-match",
): any[] => {
  return data.map((row, index) => {
    const filtered: Record<string, any> = {};

    filtered["idx"] = buildBucketRowId(bucketKey, index);

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
  type: BucketKey = "no-match",
): any[] => {
  return data.map((row, index) => {
    return {
      ...row,
      idx: buildBucketRowId(type, index),
    };
  });
};

export const splitData = (
  data: any[],
  group: BucketKey,
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
        insurerRow["idx"] = buildBucketRowId(group, index);
      } else {
        // Keep original key for CBL object
        cblRow[key] = row[key];
        cblRow["idx"] = buildBucketRowId(group, index);
      }
    }

    cbl.push(cblRow);
    insurer.push(insurerRow);
  });

  return { cbl, insurer };
};

export const mergeData = (cbl: any[], insurer: any[]): any[] => {
  return cbl.map((cblRow, index) => {
    const insurerRow = insurer[index];

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
            value === "" ? null : insurerRow[key];
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
      processedCblRow[key] = value === "" ? null : cblRow[key];
    }

    return { ...processedCblRow, ...insurerWithPostfix };
  });
};

export const addPostfix = (data: any[]): any[] => {
  return data.map((row, index) => {
    const filtered: Record<string, any> = {};
    filtered["idx"] = buildBucketRowId("no-match", index);

    for (const key in row) {
      if (key !== "idx") {
        filtered[`${key}_INSURER`] = row[key];
      }
    }
    return filtered;
  });
};
