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

const createUniqueSheetName = (baseName: string, usedSheetNames: Set<string>): string => {
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

  const dynamicSummaryRows = dynamicBuckets.map((bucket) => {
    const bucketRows = dynamicBucketSheets[bucket.BucketKey] || [];
    const cblSum = bucketRows.reduce(
      (sum, row) => sum + (Number(row.ProcessedAmount) || 0),
      0,
    );
    const insurerSum = bucketRows.reduce(
      (sum, row) => sum + (Number(row.ProcessedAmount_INSURER) || 0),
      0,
    );

    return {
      Details: bucket.BucketName,
      "No of tran CBL": bucketRows.length,
      CBL: cblSum,
      [`No of tran ${insuranceName}`]: bucketRows.length,
      [insuranceName]: insurerSum,
      Diff: cblSum - insurerSum,
    };
  });

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Create summary data in the requested format (CBL first)
  const summaryData = [
    {
      Details: "Exact Match",
      "No of tran CBL": exactMatches.length,
      CBL: exactMatchSumCBL,
      [`No of tran ${insuranceName}`]: exactMatches.length,
      [insuranceName]: exactMatchSumInsurer,
      Diff: exactMatchSumCBL - exactMatchSumInsurer,
    },
    {
      Details: "Match With Diff",
      "No of tran CBL": partialMatches.length,
      CBL: partialMatchSumCBL,
      [`No of tran ${insuranceName}`]: partialMatches.length,
      [insuranceName]: partialMatchSumInsurer,
      Diff: partialMatchSumCBL - partialMatchSumInsurer,
    },
    {
      Details: "Not Found",
      "No of tran CBL": noMatchesCBL.length,
      CBL: noMatchSumCBL,
      [`No of tran ${insuranceName}`]: noMatchesInsurer.length,
      [insuranceName]: noMatchSumInsurer,
      Diff: noMatchSumCBL - noMatchSumInsurer,
    },
    ...dynamicSummaryRows,
    {
      Details: "Total",
      "No of tran CBL":
        exactMatches.length +
        partialMatches.length +
        noMatchesCBL.length +
        dynamicSummaryRows.reduce((sum, row) => sum + row["No of tran CBL"], 0),
      CBL:
        exactMatchSumCBL +
        partialMatchSumCBL +
        noMatchSumCBL +
        dynamicSummaryRows.reduce((sum, row) => sum + row.CBL, 0),
      [`No of tran ${insuranceName}`]:
        exactMatches.length +
        partialMatches.length +
        noMatchesInsurer.length +
        dynamicSummaryRows.reduce(
          (sum, row) => sum + row[`No of tran ${insuranceName}`],
          0,
        ),
      [insuranceName]:
        exactMatchSumInsurer +
        partialMatchSumInsurer +
        noMatchSumInsurer +
        dynamicSummaryRows.reduce((sum, row) => sum + row[insuranceName], 0),
      Diff:
        exactMatchSumCBL -
        exactMatchSumInsurer +
        (partialMatchSumCBL - partialMatchSumInsurer) +
        (noMatchSumCBL - noMatchSumInsurer) +
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
    "Partial Matches"
  );
  XLSX.utils.book_append_sheet(workbook, noMatchesCBLSheet, "No Matches CBL");
  XLSX.utils.book_append_sheet(
    workbook,
    noMatchesInsurerSheet,
    `No Matches Insurer`
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
