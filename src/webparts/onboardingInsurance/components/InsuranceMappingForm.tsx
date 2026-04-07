import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import styles from "./OnboardingInsurance.module.scss";
import { useSpContext } from "../../../SpContext";
import {
  Toast,
  ToastTitle,
  useId,
  useToastController,
  Toaster,
  Spinner,
} from "@fluentui/react-components";
import { Button, message, Upload, UploadProps, Select } from "antd";
import { ArrowLeftRegular, DeleteRegular } from "@fluentui/react-icons";
import type { SavedMapping } from "./InsuranceMappingsList";

type MappingRow = {
  insurerColumn: string;
  cblFields: string[];
};

type Props = {
  mode: "create" | "edit";
  cblFields: string[];
  existingMapping?: SavedMapping | null;
  onSaveComplete: () => void;
  onCancel: () => void;
};

export default function InsuranceMappingForm({
  mode,
  cblFields,
  existingMapping,
  onSaveComplete,
  onCancel,
}: Props) {
  const [insuranceName, setInsuranceName] = useState("");
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [rawData, setRawData] = useState<any[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);

  const { sp, context } = useSpContext();
  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);

  // Initialize edit mode
  useEffect(() => {
    if (mode === "edit" && existingMapping) {
      setInsuranceName(existingMapping.Title);
      try {
        const parsed: Record<string, string | string[]> = JSON.parse(
          existingMapping.ColumnMappings || "{}",
        );
        const rows: MappingRow[] = Object.entries(parsed).map(
          ([key, value]) => ({
            insurerColumn: key,
            cblFields: Array.isArray(value) ? value : [value],
          }),
        );
        setMappingRows(rows);
      } catch {
        setMappingRows([]);
      }
    }
  }, [mode, existingMapping]);

  const detectHeaderRow = (sheetData: any[][]): number => {
    if (sheetData.length === 0) return 0;

    let bestRow = 0;
    let maxTextCount = 0;

    for (let i = 0; i < Math.min(10, sheetData.length); i++) {
      const row = sheetData[i];
      if (!row) continue;

      const textCount = row.filter(
        (cell) =>
          cell !== null &&
          cell !== undefined &&
          typeof cell === "string" &&
          cell.trim().length > 0,
      ).length;

      if (textCount > maxTextCount) {
        maxTextCount = textCount;
        bestRow = i;
      }
    }

    return bestRow;
  };

  const extractColumns = (
    sheetData: any[][],
    headerRowIndex: number,
  ): string[] => {
    if (sheetData.length === 0 || !sheetData[headerRowIndex]) return [];

    return sheetData[headerRowIndex]
      .map((cell) => (cell ? String(cell).trim() : ""))
      .filter((cell) => cell.length > 0);
  };

  const handleHeaderRowChange = (rowIndex: number) => {
    setHeaderRow(rowIndex);
    const columns = extractColumns(rawData, rowIndex);
    applyColumns(columns);
  };

  const applyColumns = (columns: string[]) => {
    if (mode === "edit" && mappingRows.length > 0) {
      // Merge: keep existing selections for matching columns, add new ones
      const existingMap = new Map(
        mappingRows.map((r) => [r.insurerColumn, r.cblFields]),
      );
      const newRows: MappingRow[] = columns.map((col) => ({
        insurerColumn: col,
        cblFields: existingMap.get(col) || [],
      }));
      setMappingRows(newRows);
    } else {
      setMappingRows(columns.map((col) => ({ insurerColumn: col, cblFields: [] })));
    }
  };

  const fileUploadProps: UploadProps = {
    name: "file",
    accept: ".xlsx,.xls",
    multiple: false,
    fileList: fileList,
    customRequest: ({ file, onSuccess, onError, onProgress }) => {
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        onProgress?.({ percent: progress });
        if (progress >= 100) clearInterval(progressInterval);
      }, 100);

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const sheetData: any[][] = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
          });

          if (sheetData.length > 0) {
            setRawData(sheetData);

            const detectedHeaderRow = detectHeaderRow(sheetData);
            setHeaderRow(detectedHeaderRow);

            const columns = extractColumns(sheetData, detectedHeaderRow);
            applyColumns(columns);

            clearInterval(progressInterval);
            onProgress?.({ percent: 100 });
            onSuccess?.("File processed successfully");
            const fileName =
              typeof file === "string" ? "File" : (file as any).name || "File";
            message.success(`${fileName} processed successfully`);
          } else {
            throw new Error("No data found in Excel file");
          }
        } catch (error) {
          console.error("Error processing file:", error);
          clearInterval(progressInterval);
          onError?.(error);
          message.error(
            "Error processing file. Please check if it's a valid Excel file.",
          );
        }
      };

      reader.onerror = () => {
        clearInterval(progressInterval);
        onError?.(new Error("Failed to read file"));
        message.error("Failed to read file");
      };

      reader.readAsArrayBuffer(file as Blob);
    },
    onChange(info) {
      setFileList(info.fileList);
    },
  };

  const updateRowCblFields = (index: number, values: string[]) => {
    setMappingRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, cblFields: values } : row)),
    );
  };

  const removeRow = (index: number) => {
    setMappingRows((prev) => prev.filter((_, i) => i !== index));
  };

  const createInsurerFolder = async () => {
    const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/${insuranceName.toUpperCase().trim()}`;
    const existingFolder = await sp.web
      .getFolderByServerRelativePath(url)
      .select("Exists")();

    if (!existingFolder.Exists) {
      await sp.web.folders.addUsingPath(url);
    }
  };

  const createMatrixInsurerFolder = async () => {
    const url = `${context.pageContext.web.serverRelativeUrl}/Matrix/${insuranceName.toUpperCase().trim()}`;
    const existingFolder = await sp.web
      .getFolderByServerRelativePath(url)
      .select("Exists")();

    if (!existingFolder.Exists) {
      await sp.web.folders.addUsingPath(url);
    }
  };

  const buildMappingJson = (): Record<string, string | string[]> => {
    const mappingJson: Record<string, string | string[]> = {};

    // Track PolicyNo occurrences for auto-suffixing
    const policyNoCounter: Record<string, number> = {};

    mappingRows.forEach(({ insurerColumn, cblFields: fields }) => {
      if (fields.length === 0) return;

      const processedFields = fields.map((field) => {
        if (field === "PolicyNo") {
          policyNoCounter[field] = (policyNoCounter[field] || 0) + 1;
          return `${field}_${policyNoCounter[field]}`;
        }
        return field;
      });

      mappingJson[insurerColumn] =
        processedFields.length === 1 ? processedFields[0] : processedFields;
    });

    return mappingJson;
  };

  const handleSave = async () => {
    setIsSaving(true);

    const mappingJson = buildMappingJson();

    try {
      if (mode === "create") {
        await sp.web.lists.getByTitle("Mappings").items.add({
          Title: insuranceName.toUpperCase().trim(),
          ColumnMappings: JSON.stringify(mappingJson),
        });
        await createInsurerFolder();
        await createMatrixInsurerFolder();
      } else {
        await sp.web.lists
          .getByTitle("Mappings")
          .items.getById(existingMapping!.Id)
          .update({
            ColumnMappings: JSON.stringify(mappingJson),
          });
      }

      dispatchToast(
        <Toast
          style={{
            backgroundColor: "green",
            color: "white",
            borderRadius: "10px",
          }}
        >
          <ToastTitle>
            Mappings {mode === "create" ? "saved" : "updated"} successfully
          </ToastTitle>
        </Toast>,
        { position: "top", intent: "success", timeout: 1000 },
      );

      onSaveComplete();
    } catch (error) {
      console.error("Error saving mappings:", error);
      dispatchToast(
        <Toast
          style={{
            backgroundColor: "red",
            color: "white",
            borderRadius: "10px",
          }}
        >
          <ToastTitle>Error saving mappings</ToastTitle>
        </Toast>,
        { position: "top", intent: "error", timeout: 1000 },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const hasMappedRows = mappingRows.some((r) => r.cblFields.length > 0);
  const canSave =
    insuranceName.trim() !== "" && mappingRows.length > 0 && hasMappedRows;

  // In edit mode, strip PolicyNo suffixes for display
  const displayCblValue = (field: string): string => {
    return field.replace(/_\d+$/, "");
  };

  return (
    <>
      <Toaster toasterId={toasterId} />
      <div className={styles["mapping-container"]}>
        <div className={styles["form-header"]}>
          <Button
            icon={<ArrowLeftRegular />}
            type="text"
            onClick={onCancel}
          />
          <h5 className="mb-0">
            {mode === "create" ? "Onboard New Insurance" : `Edit ${existingMapping?.Title}`}
          </h5>
        </div>

        <div className={styles["input-group"]}>
          <label>Insurance Name</label>
          <input
            type="text"
            value={insuranceName}
            onChange={(e) => setInsuranceName(e.target.value)}
            placeholder="Enter insurance name"
            disabled={mode === "edit"}
          />
        </div>

        <div className={styles["dropzone-single"]}>
          <label>Upload Insurer File</label>
          <Upload {...fileUploadProps}>
            <Button>
              {mode === "edit"
                ? "Upload New Insurer File (optional)"
                : "Click to Upload Insurer File"}
            </Button>
          </Upload>
        </div>

        {/* Header Row Selection */}
        {rawData.length > 0 && (
          <div className={styles["input-group"]}>
            <label>
              Header Row (Auto-detected: Row {headerRow + 1})
            </label>
            <select
              value={headerRow}
              onChange={(e) =>
                handleHeaderRowChange(parseInt(e.target.value))
              }
            >
              {rawData.slice(0, 10).map((_, index) => (
                <option key={index} value={index}>
                  Row {index + 1}:{" "}
                  {rawData[index]?.slice(0, 3).join(", ") || "Empty"}
                </option>
              ))}
            </select>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
              <strong>Preview:</strong>{" "}
              {extractColumns(rawData, headerRow).join(", ")}
            </div>
          </div>
        )}

        {/* Mapping Table */}
        {mappingRows.length > 0 && (
          <div className={styles["mapping-section"]}>
            <h6>Column Mapping</h6>

            <table className={styles["mapping-table"]}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Insurer Column</th>
                  <th>CBL Field(s)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mappingRows.map((row, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{row.insurerColumn}</td>
                    <td>
                      <Select
                        mode="multiple"
                        placeholder="Select CBL field(s)"
                        value={row.cblFields.map(displayCblValue)}
                        onChange={(values: string[]) =>
                          updateRowCblFields(index, values)
                        }
                        style={{ width: "100%" }}
                        options={cblFields.map((f) => ({
                          label: f,
                          value: f,
                        }))}
                        getPopupContainer={(trigger) => trigger.parentElement!}
                      />
                    </td>
                    <td>
                      <Button
                        icon={<DeleteRegular />}
                        type="text"
                        danger
                        size="small"
                        onClick={() => removeRow(index)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              className={styles["save-btn"]}
              onClick={handleSave}
              disabled={!canSave || isSaving}
            >
              {isSaving ? (
                <Spinner size="tiny" />
              ) : mode === "create" ? (
                "Save Mappings"
              ) : (
                "Update Mappings"
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
