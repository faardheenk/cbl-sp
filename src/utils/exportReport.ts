import * as XLSX from "xlsx";
import { DynamicBucketDefinition } from "./reconciliationBuckets";

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

  dynamicBuckets.forEach((bucket) => {
    const bucketSheet = XLSX.utils.json_to_sheet(
      dynamicBucketSheets[bucket.BucketKey] || [],
    );
    XLSX.utils.book_append_sheet(workbook, bucketSheet, bucket.BucketKey);
  });

  if (dynamicBuckets.length > 0) {
    const bucketConfigSheet = XLSX.utils.json_to_sheet(dynamicBuckets);
    XLSX.utils.book_append_sheet(workbook, bucketConfigSheet, "_BucketConfig");
  }

  return workbook;
};
