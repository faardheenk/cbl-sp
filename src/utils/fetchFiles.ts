// import { useSpContext } from "../SpContext";
import * as XLSX from "xlsx";
import { SPFI } from "@pnp/sp";
import { useEffect } from "react";
import { filterData, splitData } from "./filterData";
import { convertToTableColumns } from "./utils";
import { ColumnsType } from "antd/es/table";

export type FetchedFileType = {
  exactMatchCBL: any[];
  exactMatchInsurer: any[];
  partialMatchCBL: any[];
  partialMatchInsurer: any[];
  noMatchCBL: any[];
  noMatchInsurer: any[];
  columnNames: {
    cbl: ColumnsType;
    insurer: ColumnsType;
  };
};

export const fetchFile = async (
  url: string,
  sp: SPFI,
): Promise<FetchedFileType> => {
  try {
    // Validate that sp is properly initialized
    if (!sp) {
      throw new Error("SharePoint context (sp) is not initialized");
    }

    if (!sp.web) {
      throw new Error("SharePoint web context is not available");
    }

    const arrayBuffer: ArrayBuffer = await sp.web
      .getFileByServerRelativePath(url)
      .getBuffer();

    // Parse Excel data from buffer
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });

    // const completeMatchWorksheet = workbook.Sheets["Complete Matches"];
    const exactMatchesWorksheet = workbook.Sheets["Exact Matches"];
    const partialMatchesWorksheet = workbook.Sheets["Partial Matches"];
    const noMatchesFile1Worksheet = workbook.Sheets["No Matches CBL"];
    const noMatchesFile2Worksheet = workbook.Sheets["No Matches Insurer"];

    const exactMatches = XLSX.utils.sheet_to_json(exactMatchesWorksheet, {
      defval: "",
    });

    const partialMatches = XLSX.utils.sheet_to_json(partialMatchesWorksheet, {
      defval: "",
    });

    const noMatchCBLJson = XLSX.utils.sheet_to_json(noMatchesFile1Worksheet, {
      defval: "",
    });

    const noMatchInsurerJson = XLSX.utils.sheet_to_json(
      noMatchesFile2Worksheet,
      {
        defval: "",
      },
    );

    const { cbl: exactMatchCBL, insurer: exactMatchInsurer } = splitData(
      exactMatches,
      "exact",
    );

    const { cbl: partialMatchCBL, insurer: partialMatchInsurer } = splitData(
      partialMatches,
      "partial",
    );

    const noMatchCBL = filterData("", noMatchCBLJson);

    const noMatchInsurer = filterData("_INSURER", noMatchInsurerJson);

    // Columns to exclude from display (internal/metadata columns)
    const columnsToExclude = [
      "matched_insurer_indices",
      "Placing No.",
      "PlacingNo_Clean",
      "Amount_Clean",
      "match_status",
      "match_pass",
      "matched_amtdue_total",
      "partial_candidates_indices",
      "match_resolved_in_pass",
      "partial_resolved_in_pass",
      "string matching_INSURER",
      "PlacingNo_Clean_INSURER",
      "PolicyNo_1_Clean_INSURER",
      "PolicyNo_2_Clean_INSURER",
      "Amount_Clean_INSURER",
      "string matching",
      "PolicyNo_1_Clean",
      "PolicyNo_2_Clean",
      "PolicyNo_Clean",
      "MatrixKey",
      "ProcessedAmount_Clean",
      "ClientName_Clean",
      "match_reason",
      "group_id",
      "corporate_root",
      "match_confidence",
    ];

    const cblColumns =
      noMatchCBL && noMatchCBL.length > 0
        ? Object.keys(noMatchCBL[0] as Record<string, any>)
        : [];
    const insurerColumns =
      noMatchInsurer && noMatchInsurer.length > 0
        ? Object.keys(noMatchInsurer[0] as Record<string, any>)
        : [];

    // Filter out excluded columns and idx
    const filteredCblColumns = cblColumns.filter(
      (key) => !columnsToExclude.includes(key) && key !== "idx",
    );
    const filteredInsurerColumns = insurerColumns.filter(
      (key) => !columnsToExclude.includes(key) && key !== "idx",
    );

    const cblTableColumns = convertToTableColumns(filteredCblColumns);
    const insurerTableColumns = convertToTableColumns(filteredInsurerColumns);

    return {
      exactMatchCBL,
      exactMatchInsurer,
      partialMatchCBL,
      partialMatchInsurer,
      noMatchCBL,
      noMatchInsurer,
      columnNames: {
        cbl: cblTableColumns,
        insurer: insurerTableColumns,
      },
    };
  } catch (error) {
    console.error("Error reading Excel file:", error);

    // Provide more specific error messages
    if (!sp) {
      throw new Error(
        "SharePoint context is not initialized. Make sure the component is wrapped in SpContext.Provider.",
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("Cannot read properties of undefined")) {
        throw new Error(
          "SharePoint context is undefined. The component may not be properly initialized within the SharePoint framework.",
        );
      }
      throw error;
    }

    throw new Error(`Failed to fetch file: ${error}`);
  }
};
