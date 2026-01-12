import { SPFI } from "@pnp/sp";
import * as XLSX from "xlsx";

export const uploadFiles = async (
  sp: SPFI,
  partialMatchesFile1: any[],
  partialMatchesFile2: any[],
  folderUrl: string
) => {
  const newWorkbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    newWorkbook,
    XLSX.utils.json_to_sheet(partialMatchesFile1),
    "Partial Matches File1"
  );

  XLSX.utils.book_append_sheet(
    newWorkbook,
    XLSX.utils.json_to_sheet(partialMatchesFile2),
    "Partial Matches File2"
  );

  const wbArray: ArrayBuffer = XLSX.write(newWorkbook, {
    bookType: "xlsx",
    type: "array",
  });

  await sp.web.getFolderByServerRelativePath(folderUrl).files.addUsingPath(
    "Test.xlsx", // same file name
    wbArray, // your new content
    { Overwrite: true }
  );
};

export const uploadExcelFiles = async (
  sp: SPFI,
  files: File[],
  folderUrl: string,
  fileNames: string[]
) => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = fileNames[i];

    const arrayBuffer = await file.arrayBuffer();
    await sp.web
      .getFolderByServerRelativePath(folderUrl)
      .files.addUsingPath(fileName, arrayBuffer, { Overwrite: true });
  }
};
