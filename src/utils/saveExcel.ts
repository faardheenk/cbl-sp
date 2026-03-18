import { SPFI } from "@pnp/sp";
import * as XLSX from "xlsx";
import { exportReport } from "./exportReport";
import { DynamicBucketDefinition } from "./reconciliationBuckets";

export const saveExcel = async (
  sp: SPFI,
  mergedExactMatch: any[],
  mergedPartialMatch: any[],
  noMatchCBL: any[],
  noMatchInsurer: any[],
  exactMatchSum1: number,
  exactMatchSum2: number,
  partialMatchSum1: number,
  partialMatchSum2: number,
  noMatchSum1: number,
  noMatchSum2: number,
  insuranceName: string,
  folderPath: string,
  dynamicBuckets: DynamicBucketDefinition[] = [],
  dynamicBucketSheets: Record<string, any[]> = {},
) => {
  console.log("--- SAVING EXCEL ---");
  const workbook = exportReport(
    exactMatchSum1,
    exactMatchSum2,
    partialMatchSum1,
    partialMatchSum2,
    noMatchSum1,
    noMatchSum2,
    mergedExactMatch,
    mergedPartialMatch,
    noMatchCBL,
    noMatchInsurer,
    insuranceName,
    dynamicBuckets,
    dynamicBucketSheets,
  );

  console.log("--- CREATING BLOB ---");
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  console.log("--- ADDING FILE TO FOLDER ---");
  try {
    const res = await sp.web
      .getFolderByServerRelativePath(folderPath)
      .files.addUsingPath("output.xlsx", blob, { Overwrite: true });

    console.log("--- FILE SAVED ---", res);
    return { status: 200, message: "File saved successfully" };
  } catch (error) {
    console.error("Error saving Excel file:", error);
    return { status: 500, message: "Error saving Excel file" };
  }
};
