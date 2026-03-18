export type FixedBucketKey = "exact" | "partial" | "no-match";
export type BucketKey = FixedBucketKey | string;

export interface DynamicBucketDefinition {
  BucketName: string;
  BucketKey: string;
  SheetName?: string;
}

export interface BucketRows {
  cbl: any[];
  insurer: any[];
}

const FIXED_BUCKET_PREFIX: Record<FixedBucketKey, string> = {
  exact: "EM",
  partial: "PM",
  "no-match": "NM",
};

const INVALID_EXCEL_SHEET_CHARACTERS = /[:\\/?*\[\]]/g;

const sanitizeBucketSegment = (value: string): string =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "BUCKET";

const getBucketChecksum = (value: string): string => {
  let checksum = 0;

  for (let i = 0; i < value.length; i++) {
    checksum = (checksum * 31 + value.charCodeAt(i)) % 46656;
  }

  return checksum.toString(36).toUpperCase().padStart(3, "0");
};

export const normalizeBucketSheetName = (value: string): string => {
  const sanitizedValue = value
    .replace(INVALID_EXCEL_SHEET_CHARACTERS, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'+|'+$/g, "");

  return sanitizedValue.slice(0, 31) || "Bucket";
};

export const isFixedBucket = (bucketKey: BucketKey): bucketKey is FixedBucketKey =>
  bucketKey === "exact" ||
  bucketKey === "partial" ||
  bucketKey === "no-match";

export const isMatchedBucket = (bucketKey: BucketKey): boolean =>
  bucketKey !== "no-match";

export const getBucketPrefix = (bucketKey: BucketKey): string => {
  if (isFixedBucket(bucketKey)) {
    return FIXED_BUCKET_PREFIX[bucketKey];
  }

  return `DB${getBucketChecksum(bucketKey)}${sanitizeBucketSegment(bucketKey)}`;
};

export const buildBucketRowId = (
  bucketKey: BucketKey,
  index: number,
): string => `${getBucketPrefix(bucketKey)}-${index}`;

export const generateBucketKey = (bucketName: string): string =>
  bucketName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "bucket";
