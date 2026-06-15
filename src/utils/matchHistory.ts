import { SPFI } from "@pnp/sp";
import * as XLSX from "xlsx";
import { BucketKey } from "./reconciliationBuckets";

export interface MatchHistoryEntry {
  actionType?: "move" | "regroup";
  cblFingerprints: string[];
  insurerFingerprints: string[];
  targetCblFingerprints?: string[];
  targetInsurerFingerprints?: string[];
  orphanedCblFingerprints?: string[];
  orphanedInsurerFingerprints?: string[];
  cblRemarks?: string[];
  insurerRemarks?: string[];
  targetBucket: BucketKey;
  fromBucket: BucketKey;
  timestamp: string;
}

const CELL_CHAR_LIMIT = 15000;

const FINGERPRINT_ARRAY_KEYS = [
  "cblFingerprints",
  "insurerFingerprints",
  "targetCblFingerprints",
  "targetInsurerFingerprints",
  "orphanedCblFingerprints",
  "orphanedInsurerFingerprints",
  "cblRemarks",
  "insurerRemarks",
] as const;

const SERIALIZED_KEY_MAP: Record<string, string> = {
  cblFingerprints: "CblFingerprints",
  insurerFingerprints: "InsurerFingerprints",
  targetCblFingerprints: "TargetCblFingerprints",
  targetInsurerFingerprints: "TargetInsurerFingerprints",
  orphanedCblFingerprints: "OrphanedCblFingerprints",
  orphanedInsurerFingerprints: "OrphanedInsurerFingerprints",
  cblRemarks: "CblRemarks",
  insurerRemarks: "InsurerRemarks",
};

type SerializedRow = {
  ActionType: string;
  CblFingerprints: string;
  InsurerFingerprints: string;
  TargetCblFingerprints: string;
  TargetInsurerFingerprints: string;
  OrphanedCblFingerprints: string;
  OrphanedInsurerFingerprints: string;
  CblRemarks: string;
  InsurerRemarks: string;
  FromBucket: string;
  TargetBucket: string;
  Timestamp: string;
};

const buildRow = (
  actionType: string,
  arrays: Record<string, string[]>,
  entry: MatchHistoryEntry,
): SerializedRow => ({
  ActionType: actionType,
  CblFingerprints: JSON.stringify(arrays.cblFingerprints || []),
  InsurerFingerprints: JSON.stringify(arrays.insurerFingerprints || []),
  TargetCblFingerprints: JSON.stringify(arrays.targetCblFingerprints || []),
  TargetInsurerFingerprints: JSON.stringify(
    arrays.targetInsurerFingerprints || [],
  ),
  OrphanedCblFingerprints: JSON.stringify(arrays.orphanedCblFingerprints || []),
  OrphanedInsurerFingerprints: JSON.stringify(
    arrays.orphanedInsurerFingerprints || [],
  ),
  CblRemarks: JSON.stringify(arrays.cblRemarks || []),
  InsurerRemarks: JSON.stringify(arrays.insurerRemarks || []),
  FromBucket: entry.fromBucket,
  TargetBucket: entry.targetBucket,
  Timestamp: entry.timestamp,
});

const needsSplitting = (row: SerializedRow): boolean =>
  FINGERPRINT_ARRAY_KEYS.some(
    (key) =>
      (row[SERIALIZED_KEY_MAP[key] as keyof SerializedRow] as string).length >
      CELL_CHAR_LIMIT,
  );

const STRING_CHUNK_SIZE = CELL_CHAR_LIMIT - 100;

const chunkOversizedStrings = (arr: string[]): string[] => {
  const result: string[] = [];
  for (const str of arr) {
    if (JSON.stringify([str]).length <= CELL_CHAR_LIMIT) {
      result.push(str);
    } else {
      for (let i = 0; i < str.length; i += STRING_CHUNK_SIZE) {
        result.push(str.slice(i, i + STRING_CHUNK_SIZE));
      }
    }
  }
  return result;
};

const serializeMatchHistoryEntries = (
  entries: MatchHistoryEntry[],
): SerializedRow[] => {
  const rows: SerializedRow[] = [];

  for (const entry of entries) {
    const arrays: Record<string, string[]> = {};
    for (const key of FINGERPRINT_ARRAY_KEYS) {
      arrays[key] = chunkOversizedStrings(
        (entry[key] as string[] | undefined) || [],
      );
    }

    const firstRow = buildRow(entry.actionType || "move", arrays, entry);

    if (!needsSplitting(firstRow)) {
      rows.push(firstRow);
      continue;
    }

    const remaining: Record<string, string[]> = {};
    const current: Record<string, string[]> = {};
    for (const key of FINGERPRINT_ARRAY_KEYS) {
      remaining[key] = [...arrays[key]];
      current[key] = [];
    }

    let isFirstChunk = true;
    while (FINGERPRINT_ARRAY_KEYS.some((key) => remaining[key].length > 0)) {
      for (const key of FINGERPRINT_ARRAY_KEYS) {
        current[key] = [];
      }

      for (const key of FINGERPRINT_ARRAY_KEYS) {
        while (remaining[key].length > 0) {
          const candidate = [...current[key], remaining[key][0]];
          if (
            JSON.stringify(candidate).length > CELL_CHAR_LIMIT &&
            current[key].length > 0
          ) {
            break;
          }
          current[key].push(remaining[key].shift()!);
        }
      }

      const actionType = isFirstChunk
        ? entry.actionType || "move"
        : "continuation";
      rows.push(buildRow(actionType, current, entry));
      isFirstChunk = false;
    }
  }

  return rows;
};

const createMatchHistoryWorkbook = (entries: MatchHistoryEntry[]) => {
  const workbook = XLSX.utils.book_new();
  const sheetData = serializeMatchHistoryEntries(entries);
  const worksheet = XLSX.utils.json_to_sheet(sheetData);

  if (sheetData.length === 0) {
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [
          "ActionType",
          "CblFingerprints",
          "InsurerFingerprints",
          "TargetCblFingerprints",
          "TargetInsurerFingerprints",
          "OrphanedCblFingerprints",
          "OrphanedInsurerFingerprints",
          "CblRemarks",
          "InsurerRemarks",
          "FromBucket",
          "TargetBucket",
          "Timestamp",
        ],
      ],
      { origin: "A1" },
    );
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, "MatchHistory");
  return workbook;
};

const FINGERPRINT_EXCLUDE_COLUMNS = new Set([
  // Backend preprocessing columns
  "PlacingNo_Clean",
  "PolicyNo_Clean",
  "PolicyNo_2_Clean",
  "ProcessedAmount_Clean",
  "ClientName_Clean",

  // Backend tracking columns
  "match_status",
  "match_pass",
  "match_reason",
  "matched_insurer_indices",
  "matched_amtdue_total",
  "Amount Difference",
  "amount_difference",
  "partial_candidates_indices",
  "match_resolved_in_pass",
  "partial_resolved_in_pass",

  // Backend pass-generated columns
  "group_id",
  "corporate_root",
  "match_confidence",

  // Backend internal columns
  "_source_sheet",
  "_fingerprint",
  "_fingerprint_INSURER",

  // Output-only columns
  "MatrixKey",

  // User annotation columns
  "Remarks",
  "Remarks_INSURER",

  // Frontend-only columns
  "idx",
]);

type FingerprintOptions = {
  stripInsurerSuffix?: boolean;
};

const normalizeRowForFingerprint = (
  row: Record<string, any>,
  { stripInsurerSuffix = false }: FingerprintOptions = {},
): Record<string, any> => {
  if (!stripInsurerSuffix) {
    return row;
  }

  return Object.entries(row).reduce<Record<string, any>>(
    (acc, [key, value]) => {
      const normalizedKey = key.endsWith("_INSURER")
        ? key.slice(0, -"_INSURER".length)
        : key;
      acc[normalizedKey] = value;
      return acc;
    },
    {},
  );
};

const formatFingerprintValue = (value: any): string => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "number" && Number.isNaN(value))
  ) {
    return "";
  }

  if (value instanceof Date) {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = value.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value === Math.trunc(value)
  ) {
    return String(Math.trunc(value));
  }

  return String(value);
};

/**
 * Generate a fingerprint for a row by concatenating all non-metadata column
 * values. Keys are sorted alphabetically to ensure deterministic ordering
 * regardless of JS object property order.
 */
export const generateFingerprint = (row: Record<string, any>): string => {
  const normalizedRow = normalizeRowForFingerprint(row);
  const keys = Object.keys(normalizedRow)
    .filter((key) => !FINGERPRINT_EXCLUDE_COLUMNS.has(key))
    .sort();

  return keys
    .map((key) => formatFingerprintValue(normalizedRow[key]))
    .join("|");
};

export const generateInsurerFingerprint = (row: Record<string, any>): string =>
  generateFingerprint(
    normalizeRowForFingerprint(row, { stripInsurerSuffix: true }),
  );

export const getCanonicalCblFingerprint = (row: Record<string, any>): string =>
  String(row["_fingerprint"] ?? "");

export const getCanonicalInsurerFingerprint = (
  row: Record<string, any>,
): string => String(row["_fingerprint"] ?? row["_fingerprint_INSURER"] ?? "");

/**
 * Save match history entries to history.xlsx at the insurer level.
 * Reads the existing file (if any), appends new entries, and writes back.
 */
export const saveMatchHistory = async (
  sp: SPFI,
  entries: MatchHistoryEntry[],
  insurerName: string,
  serverRelativeUrl: string,
): Promise<void> => {
  if (!entries || entries.length === 0) return;

  const folderPath = `${serverRelativeUrl}/Matrix/${insurerName}`;
  const filePath = `${folderPath}/history.xlsx`;

  // Read existing history if the file exists
  let existingEntries: MatchHistoryEntry[] = [];
  try {
    existingEntries = await readMatchHistory(
      sp,
      insurerName,
      serverRelativeUrl,
    );
  } catch {
    // File doesn't exist yet — that's fine, we'll create it
  }

  const allEntries = [...existingEntries, ...entries];
  const workbook = createMatchHistoryWorkbook(allEntries);

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Ensure the insurer folder exists in the Matrix library
  try {
    const existingFolder = await sp.web
      .getFolderByServerRelativePath(folderPath)
      .select("Exists")();
    if (!existingFolder.Exists) {
      await sp.web.folders.addUsingPath(folderPath);
    }
  } catch {
    await sp.web.folders.addUsingPath(folderPath);
  }

  await sp.web
    .getFolderByServerRelativePath(folderPath)
    .files.addUsingPath("history.xlsx", blob, { Overwrite: true });

  console.log(
    `[Match History] Saved ${entries.length} new entries (${allEntries.length} total) to ${filePath}`,
  );
};

export const overwriteMatchHistory = async (
  sp: SPFI,
  entries: MatchHistoryEntry[],
  insurerName: string,
  serverRelativeUrl: string,
): Promise<void> => {
  const folderPath = `${serverRelativeUrl}/Matrix/${insurerName}`;
  const workbook = createMatchHistoryWorkbook(entries);
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  try {
    const existingFolder = await sp.web
      .getFolderByServerRelativePath(folderPath)
      .select("Exists")();
    if (!existingFolder.Exists) {
      await sp.web.folders.addUsingPath(folderPath);
    }
  } catch {
    await sp.web.folders.addUsingPath(folderPath);
  }

  await sp.web
    .getFolderByServerRelativePath(folderPath)
    .files.addUsingPath("history.xlsx", blob, { Overwrite: true });
};

/**
 * Read match history from history.xlsx for a given insurer.
 * Returns an empty array if the file doesn't exist.
 */
export const readMatchHistory = async (
  sp: SPFI,
  insurerName: string,
  serverRelativeUrl: string,
): Promise<MatchHistoryEntry[]> => {
  const filePath = `${serverRelativeUrl}/Matrix/${insurerName}/history.xlsx`;

  try {
    const arrayBuffer: ArrayBuffer = await sp.web
      .getFileByServerRelativePath(filePath)
      .getBuffer();

    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });

    const worksheet = workbook.Sheets["MatchHistory"];
    if (!worksheet) return [];

    const rows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });

    const entries: MatchHistoryEntry[] = [];
    let current: MatchHistoryEntry | null = null;

    for (const row of rows) {
      if (row.ActionType === "continuation" && current) {
        current.cblFingerprints.push(
          ...JSON.parse(row.CblFingerprints || "[]"),
        );
        current.insurerFingerprints.push(
          ...JSON.parse(row.InsurerFingerprints || "[]"),
        );
        current.targetCblFingerprints!.push(
          ...JSON.parse(row.TargetCblFingerprints || "[]"),
        );
        current.targetInsurerFingerprints!.push(
          ...JSON.parse(row.TargetInsurerFingerprints || "[]"),
        );
        current.orphanedCblFingerprints!.push(
          ...JSON.parse(row.OrphanedCblFingerprints || "[]"),
        );
        current.orphanedInsurerFingerprints!.push(
          ...JSON.parse(row.OrphanedInsurerFingerprints || "[]"),
        );
        current.cblRemarks!.push(...JSON.parse(row.CblRemarks || "[]"));
        current.insurerRemarks!.push(...JSON.parse(row.InsurerRemarks || "[]"));
        continue;
      }

      if (current) entries.push(current);

      current = {
        actionType: (row.ActionType ||
          "move") as MatchHistoryEntry["actionType"],
        cblFingerprints: JSON.parse(row.CblFingerprints || "[]"),
        insurerFingerprints: JSON.parse(row.InsurerFingerprints || "[]"),
        targetCblFingerprints: JSON.parse(row.TargetCblFingerprints || "[]"),
        targetInsurerFingerprints: JSON.parse(
          row.TargetInsurerFingerprints || "[]",
        ),
        orphanedCblFingerprints: JSON.parse(
          row.OrphanedCblFingerprints || "[]",
        ),
        orphanedInsurerFingerprints: JSON.parse(
          row.OrphanedInsurerFingerprints || "[]",
        ),
        cblRemarks: JSON.parse(row.CblRemarks || "[]"),
        insurerRemarks: JSON.parse(row.InsurerRemarks || "[]"),
        fromBucket: row.FromBucket as BucketKey,
        targetBucket: row.TargetBucket as BucketKey,
        timestamp: row.Timestamp,
      };
    }

    if (current) entries.push(current);

    return entries;
  } catch (error) {
    console.warn("[Match History] Could not read history.xlsx:", error);
    return [];
  }
};
