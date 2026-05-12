import * as XLSX from "xlsx";
import {
  DynamicBucketDefinition,
  normalizeBucketSheetName,
} from "./reconciliationBuckets";

const RESERVED_SHEET_NAMES = new Set([
  "Summary",
  "Exact Matches",
  "Partial Matches",
  "No Matches CBL",
  "No Matches Insurer",
  "_BucketConfig",
]);

const createUniqueSheetName = (
  baseName: string,
  usedSheetNames: Set<string>,
): string => {
  const normalizedBaseName = normalizeBucketSheetName(baseName);

  if (!usedSheetNames.has(normalizedBaseName)) {
    usedSheetNames.add(normalizedBaseName);
    return normalizedBaseName;
  }

  let counter = 2;
  while (counter < 1000) {
    const suffix = ` (${counter})`;
    const candidateName = `${normalizedBaseName.slice(0, 31 - suffix.length)}${suffix}`;

    if (!usedSheetNames.has(candidateName)) {
      usedSheetNames.add(candidateName);
      return candidateName;
    }

    counter += 1;
  }

  const fallbackSheetName = `${normalizedBaseName.slice(0, 27)}-${Date.now().toString().slice(-3)}`;
  usedSheetNames.add(fallbackSheetName);
  return fallbackSheetName;
};

const getNumericValue = (value: unknown): number => {
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? 0 : numericValue;
};

const hasNonBlankAmount = (row: any, amountKey: string): boolean => {
  const value = row?.[amountKey];
  return value !== undefined && value !== null && value !== "";
};

const countRowsWithAmount = (rows: any[], amountKey: string): number =>
  rows.filter((row) => hasNonBlankAmount(row, amountKey)).length;

const sumRowsByAmount = (rows: any[], amountKey: string): number =>
  rows.reduce((sum, row) => sum + getNumericValue(row?.[amountKey]), 0);

const countInsurerRows = (rows: any[]): number =>
  rows.filter(
    (row) =>
      hasNonBlankAmount(row, "ProcessedAmount_INSURER") ||
      hasNonBlankAmount(row, "ProcessedAmount"),
  ).length;

type SummaryRow = {
  Details: string;
  "No of tran CBL": number;
  CBL: number;
  Diff: number;
  [key: string]: string | number;
};

export const exportReport = (
  exactMatchSumCBL: number,
  exactMatchSumInsurer: number,
  partialMatchSumCBL: number,
  partialMatchSumInsurer: number,
  noMatchSumCBL: number,
  noMatchSumInsurer: number,
  exactMatches: any[],
  partialMatches: any[],
  noMatchesCBL: any[],
  noMatchesInsurer: any[],
  insuranceName: string = "",
  dynamicBuckets: DynamicBucketDefinition[] = [],
  dynamicBucketSheets: Record<string, any[]> = {},
) => {
  const usedSheetNames = new Set(RESERVED_SHEET_NAMES);
  const exportDynamicBuckets = dynamicBuckets.map((bucket) => ({
    ...bucket,
    SheetName: createUniqueSheetName(
      bucket.BucketName || bucket.BucketKey,
      usedSheetNames,
    ),
  }));

  const dynamicSummaryRows: SummaryRow[] = dynamicBuckets.map((bucket) => {
    const bucketRows = dynamicBucketSheets[bucket.BucketKey] || [];
    const cblCount = countRowsWithAmount(bucketRows, "ProcessedAmount");
    const insurerCount = countRowsWithAmount(
      bucketRows,
      "ProcessedAmount_INSURER",
    );
    const cblSum = sumRowsByAmount(bucketRows, "ProcessedAmount");
    const insurerSum = sumRowsByAmount(bucketRows, "ProcessedAmount_INSURER");

    return {
      Details: bucket.BucketName,
      "No of tran CBL": cblCount,
      CBL: cblSum,
      [`No of tran ${insuranceName}`]: insurerCount,
      [insuranceName]: insurerSum,
      Diff: cblSum + insurerSum,
    };
  });

  const exactMatchCblCount = countRowsWithAmount(
    exactMatches,
    "ProcessedAmount",
  );
  const exactMatchInsurerCount = countRowsWithAmount(
    exactMatches,
    "ProcessedAmount_INSURER",
  );
  const partialMatchCblCount = countRowsWithAmount(
    partialMatches,
    "ProcessedAmount",
  );
  const partialMatchInsurerCount = countRowsWithAmount(
    partialMatches,
    "ProcessedAmount_INSURER",
  );
  const noMatchCblCount = countRowsWithAmount(noMatchesCBL, "ProcessedAmount");
  const noMatchInsurerCount = countInsurerRows(noMatchesInsurer);

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Create summary data in the requested format (CBL first)
  const summaryData = [
    {
      Details: "Exact Match",
      "No of tran CBL": exactMatchCblCount,
      CBL: exactMatchSumCBL,
      [`No of tran ${insuranceName}`]: exactMatchInsurerCount,
      [insuranceName]: exactMatchSumInsurer,
      Diff: exactMatchSumCBL + exactMatchSumInsurer,
    },
    {
      Details: "Partial Matches",
      "No of tran CBL": partialMatchCblCount,
      CBL: partialMatchSumCBL,
      [`No of tran ${insuranceName}`]: partialMatchInsurerCount,
      [insuranceName]: partialMatchSumInsurer,
      Diff: partialMatchSumCBL + partialMatchSumInsurer,
    },
    {
      Details: "Not Found",
      "No of tran CBL": noMatchCblCount,
      CBL: noMatchSumCBL,
      [`No of tran ${insuranceName}`]: noMatchInsurerCount,
      [insuranceName]: noMatchSumInsurer,
      Diff: noMatchSumCBL + noMatchSumInsurer,
    },
    ...dynamicSummaryRows,
    {
      Details: "Total",
      "No of tran CBL":
        exactMatchCblCount +
        partialMatchCblCount +
        noMatchCblCount +
        dynamicSummaryRows.reduce((sum, row) => sum + row["No of tran CBL"], 0),
      CBL:
        exactMatchSumCBL +
        partialMatchSumCBL +
        noMatchSumCBL +
        dynamicSummaryRows.reduce((sum, row) => sum + row.CBL, 0),
      [`No of tran ${insuranceName}`]:
        exactMatchInsurerCount +
        partialMatchInsurerCount +
        noMatchInsurerCount +
        dynamicSummaryRows.reduce(
          (sum, row) =>
            sum + getNumericValue(row[`No of tran ${insuranceName}`]),
          0,
        ),
      [insuranceName]:
        exactMatchSumInsurer +
        partialMatchSumInsurer +
        noMatchSumInsurer +
        dynamicSummaryRows.reduce(
          (sum, row) => sum + getNumericValue(row[insuranceName]),
          0,
        ),
      Diff:
        exactMatchSumCBL +
        exactMatchSumInsurer +
        partialMatchSumCBL +
        partialMatchSumInsurer +
        noMatchSumCBL +
        noMatchSumInsurer +
        dynamicSummaryRows.reduce((sum, row) => sum + row.Diff, 0),
    },
  ];

  // Create worksheets from the data arrays
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  const exactMatchesSheet = XLSX.utils.json_to_sheet(exactMatches);
  const partialMatchesSheet = XLSX.utils.json_to_sheet(partialMatches);
  const noMatchesCBLSheet = XLSX.utils.json_to_sheet(noMatchesCBL);
  const noMatchesInsurerSheet = XLSX.utils.json_to_sheet(noMatchesInsurer);

  // Add sheets to the workbook with descriptive names (Summary first)
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, exactMatchesSheet, "Exact Matches");
  XLSX.utils.book_append_sheet(
    workbook,
    partialMatchesSheet,
    "Partial Matches",
  );
  XLSX.utils.book_append_sheet(workbook, noMatchesCBLSheet, "No Matches CBL");
  XLSX.utils.book_append_sheet(
    workbook,
    noMatchesInsurerSheet,
    `No Matches Insurer`,
  );

  exportDynamicBuckets.forEach((bucket) => {
    const bucketSheet = XLSX.utils.json_to_sheet(
      dynamicBucketSheets[bucket.BucketKey] || [],
    );
    XLSX.utils.book_append_sheet(
      workbook,
      bucketSheet,
      bucket.SheetName || bucket.BucketKey,
    );
  });

  if (exportDynamicBuckets.length > 0) {
    const bucketConfigSheet = XLSX.utils.json_to_sheet(exportDynamicBuckets);
    XLSX.utils.book_append_sheet(workbook, bucketConfigSheet, "_BucketConfig");
  }

  return workbook;
};
