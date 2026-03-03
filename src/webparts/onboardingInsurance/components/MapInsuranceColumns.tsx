import React, { useState, ChangeEvent, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import styles from "./OnboardingInsurance.module.scss";
import { getSP } from "../../../pnpjsConfig";
import { useSpContext } from "../../../SpContext";
import {
  Toast,
  ToastTitle,
  ToastIntent,
  useId,
  useToastController,
  Toaster,
  Spinner,
} from "@fluentui/react-components";
import { Button, message, Upload, UploadProps } from "antd";

interface ColumnMappingType {
  file1Column: string;
  file2Column: string;
}

type InsuranceMappingType = {
  InsuranceName: string;
  MappingJson: Record<string, any>;
};

type Props = {
  isSaving: boolean;
  setIsSaving: (isSaving: boolean) => void;
};

export default function MapInsuranceColumns({ isSaving, setIsSaving }: Props) {
  const [insuranceName, setInsuranceName] = useState<string>("");
  const [file1Columns, setFile1Columns] = useState<string[]>([]);
  const [file2Columns, setFile2Columns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMappingType[]>([]);
  const [selectedFile1Column, setSelectedFile1Column] = useState<string>("");
  const [selectedFile2Column, setSelectedFile2Column] = useState<string>("");
  const [cblInsuranceMapping, setCblInsuranceMapping] =
    useState<InsuranceMappingType>({
      InsuranceName: "",
      MappingJson: {},
    });

  const [file1List, setFile1List] = useState<any[]>([]);
  const [file2List, setFile2List] = useState<any[]>([]);
  const [file1HeaderRow, setFile1HeaderRow] = useState<number>(0);
  const [file2HeaderRow, setFile2HeaderRow] = useState<number>(0);
  const [file1RawData, setFile1RawData] = useState<any[][]>([]);
  const [file2RawData, setFile2RawData] = useState<any[][]>([]);

  const file1InputRef = useRef<HTMLInputElement>(null);
  const file2InputRef = useRef<HTMLInputElement>(null);

  const { sp, context } = useSpContext();

  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);

  // Helper function to detect the header row
  const detectHeaderRow = (sheetData: any[][]): number => {
    if (sheetData.length === 0) return 0;

    let bestRow = 0;
    let maxTextCount = 0;

    // Check first 10 rows to find the one with most text values
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

  // Helper function to extract columns from detected header row
  const extractColumns = (
    sheetData: any[][],
    headerRowIndex: number,
  ): string[] => {
    if (sheetData.length === 0 || !sheetData[headerRowIndex]) return [];

    return sheetData[headerRowIndex]
      .map((cell) => (cell ? String(cell).trim() : ""))
      .filter((cell) => cell.length > 0);
  };

  // Upload props for File 1
  const file1UploadProps: UploadProps = {
    name: "file",
    accept: ".xlsx,.xls",
    multiple: false,
    fileList: file1List,
    customRequest: ({ file, onSuccess, onError, onProgress }) => {
      // Simulate upload progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        onProgress?.({ percent: progress });

        if (progress >= 100) {
          clearInterval(progressInterval);
        }
      }, 100);

      // Read file content for Excel processing
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
            // Store raw data for header row selection
            setFile1RawData(sheetData);

            // Auto-detect header row
            const detectedHeaderRow = detectHeaderRow(sheetData);
            setFile1HeaderRow(detectedHeaderRow);

            // Extract columns from detected header row
            const columns = extractColumns(sheetData, detectedHeaderRow);
            console.log("File 1 Excel columns:", columns);
            console.log("File 1 detected header row:", detectedHeaderRow);
            setFile1Columns(columns);
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
          console.error("Error processing file 1:", error);
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
      console.log("File 1 upload info:", info);
      setFile1List(info.fileList);
    },
  };

  // Upload props for File 2
  const file2UploadProps: UploadProps = {
    name: "file",
    accept: ".xlsx,.xls",
    fileList: file2List,
    multiple: false,
    customRequest: ({ file, onSuccess, onError, onProgress }) => {
      console.log("File 2 to be processed:", file);

      // Simulate upload progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        onProgress?.({ percent: progress });

        if (progress >= 100) {
          clearInterval(progressInterval);
        }
      }, 100);

      // Read file content for Excel processing
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
            // Store raw data for header row selection
            setFile2RawData(sheetData);

            // Auto-detect header row
            const detectedHeaderRow = detectHeaderRow(sheetData);
            setFile2HeaderRow(detectedHeaderRow);

            // Extract columns from detected header row
            const columns = extractColumns(sheetData, detectedHeaderRow);
            console.log("File 2 Excel columns:", columns);
            console.log("File 2 detected header row:", detectedHeaderRow);
            setFile2Columns(columns);
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
          console.error("Error processing file 2:", error);
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
      console.log("File 2 upload info:", info);
      setFile2List(info.fileList);
    },
  };

  // Add a File1 -> File2 mapping
  const addMapping = () => {
    if (!selectedFile1Column || !selectedFile2Column) return;

    // Check if this exact mapping already exists
    const existing = mappings.find(
      (m) =>
        m.file1Column === selectedFile1Column &&
        m.file2Column === selectedFile2Column,
    );

    if (!existing) {
      setMappings([
        ...mappings,
        {
          file1Column: selectedFile1Column,
          file2Column: selectedFile2Column,
        },
      ]);
    }

    setSelectedFile2Column(""); // reset for next selection
  };

  // Remove a specific mapping
  const removeMapping = (file1Col: string, file2Col: string) => {
    const updated = mappings.filter(
      (m) => !(m.file1Column === file1Col && m.file2Column === file2Col),
    );
    setMappings(updated);
  };

  // Handle manual header row selection for File 1
  const handleFile1HeaderRowChange = (rowIndex: number) => {
    setFile1HeaderRow(rowIndex);
    const columns = extractColumns(file1RawData, rowIndex);
    setFile1Columns(columns);
  };

  // Handle manual header row selection for File 2
  const handleFile2HeaderRowChange = (rowIndex: number) => {
    setFile2HeaderRow(rowIndex);
    const columns = extractColumns(file2RawData, rowIndex);
    setFile2Columns(columns);
  };

  const createInsurerFolder = async () => {
    const url = `${
      context.pageContext.web.serverRelativeUrl
    }/Reconciliation Library/${insuranceName.toUpperCase().trim()}`;

    const existingFolder = await sp.web
      .getFolderByServerRelativePath(url)
      .select(`Exists`)();

    if (!existingFolder.Exists) {
      const folder = await sp.web.folders.addUsingPath(url);
      return folder;
    }

    return;
  };

  const createMatrixInsurerFolder = async () => {
    try {
      const insuranceNameUpper = insuranceName.toUpperCase().trim();
      console.log("Looking for existing folder with name:", insuranceNameUpper);

      // First, let's get all items to see what's actually in the list
      const allItems = await sp.web.lists
        .getByTitle("Matrix")
        .items.select("Id,Title,FileSystemObjectType,ContentTypeId")();

      console.log("All items in Matrix list:", allItems);

      // Check if a folder with this insurance name already exists
      const existingItems = allItems.filter(
        (item) =>
          item.Title === insuranceNameUpper && item.FileSystemObjectType === 1,
      );

      console.log("Filtered existing items:", existingItems);

      if (existingItems.length === 0) {
        console.log("No existing folder found, creating new one...");
        // Create a new folder in the Matrix list
        const newFolder = await sp.web.lists.getByTitle("Matrix").items.add({
          Title: insuranceNameUpper,
          ContentTypeId: "0x0120", // Folder content type
        });

        console.log("Created new folder:", newFolder);
        return newFolder;
      }

      console.log("Found existing folder:", existingItems[0]);
      return existingItems[0]; // Return existing folder
    } catch (error) {
      console.error("Error creating Matrix list folder:", error);
      throw error;
    }
  };

  const saveMappings = async () => {
    setIsSaving(true);
    const newMapping: Record<string, string | string[]> = {};

    const { MappingJson: cblMappingJson } = cblInsuranceMapping;

    // Track PolicyNo suffixes for incrementing
    let policyNoCounter = 1;

    mappings.forEach(({ file1Column, file2Column }) => {
      const genericKey = cblMappingJson[file1Column];
      if (genericKey) {
        let value: string;
        if (genericKey === "PolicyNo") {
          // Always use incremental _1, _2, ... for PolicyNo
          value = `${genericKey}_${policyNoCounter}`;
          policyNoCounter++;
        } else {
          value = genericKey;
        }

        // Handle duplicate keys by creating arrays
        if (newMapping[file2Column]) {
          // If key already exists, convert to array or add to existing array
          if (Array.isArray(newMapping[file2Column])) {
            (newMapping[file2Column] as string[]).push(value);
          } else {
            // Convert existing single value to array and add new value
            newMapping[file2Column] = [
              newMapping[file2Column] as string,
              value,
            ];
          }
        } else {
          // First occurrence, set as single value
          newMapping[file2Column] = value;
        }
      }
    });

    sp.web.lists
      .getByTitle("Mappings")
      .items.add({
        Title: insuranceName.toUpperCase().trim(),
        ColumnMappings: JSON.stringify(newMapping),
      })
      .then(async () => {
        console.log("Mappings saved successfully");
        await createInsurerFolder();
        await createMatrixInsurerFolder();

        dispatchToast(
          <Toast
            style={{
              backgroundColor: "green",
              color: "white",
              borderRadius: "10px",
            }}
          >
            <ToastTitle>Mappings saved successfully</ToastTitle>
          </Toast>,
          { position: "top", intent: "success", timeout: 1000 },
        );
      })
      .catch((error) => {
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
      })
      .finally(() => {
        setIsSaving(false);
        setInsuranceName("");
        setFile1Columns([]);
        setFile2Columns([]);
        setMappings([]);
        setSelectedFile1Column("");
        setSelectedFile2Column("");
        setCblInsuranceMapping({ InsuranceName: "", MappingJson: {} });
        setFile1List([]);
        setFile2List([]);
        setFile1HeaderRow(0);
        setFile2HeaderRow(0);
        setFile1RawData([]);
        setFile2RawData([]);
        // Clear file inputs
        if (file1InputRef.current) file1InputRef.current.value = "";
        if (file2InputRef.current) file2InputRef.current.value = "";

        // Refetch CBL mapping data for next mapping session
        fetchExistingInsuranceMappings();
      });
  };

  async function fetchExistingInsuranceMappings() {
    const items: any[] = await sp.web.lists.getByTitle("Mappings").items();
    console.log(items);

    const { Title: InsuranceName, ColumnMappings } = items.find(
      (item) => item.Title === "CBL",
    );

    if (InsuranceName && ColumnMappings) {
      setCblInsuranceMapping({
        InsuranceName,
        MappingJson: JSON.parse(ColumnMappings),
      });
    }
  }

  useEffect(() => {
    fetchExistingInsuranceMappings();
  }, []);

  return (
    <>
      <Toaster toasterId={toasterId} />
      <div className={styles["mapping-container"]}>
        <h5 className="mb-4">Insurance Column Mapping</h5>

        <div className={styles["input-group"]}>
          <label>Insurance Name</label>
          <input
            type="text"
            value={insuranceName}
            onChange={(e) => setInsuranceName(e.target.value)}
            placeholder="Enter insurance name"
          />
        </div>

        <div className={styles["file-dropzones"]}>
          <div className={styles["dropzone"]}>
            <label>Upload File 1</label>
            {/* <input
                ref={file1InputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => handleFileUpload(e, setFile1Columns)}
              /> */}

            <Upload {...file1UploadProps}>
              <Button>Click to Upload File 1</Button>
            </Upload>
          </div>
          <div className={styles["dropzone"]}>
            <label>Upload File 2</label>
            {/* <input
                ref={file2InputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => handleFileUpload(e, setFile2Columns)}
              /> */}

            <Upload {...file2UploadProps}>
              <Button>Click to Upload File 2</Button>
            </Upload>
          </div>
        </div>

        {/* Header Row Selection for File 1 */}
        {file1RawData.length > 0 && (
          <div className={styles["input-group"]}>
            <label>
              File 1 Header Row (Auto-detected: Row {file1HeaderRow + 1})
            </label>
            <select
              value={file1HeaderRow}
              onChange={(e) =>
                handleFile1HeaderRowChange(parseInt(e.target.value))
              }
            >
              {file1RawData.slice(0, 10).map((_, index) => (
                <option key={index} value={index}>
                  Row {index + 1}:{" "}
                  {file1RawData[index]?.slice(0, 3).join(", ") || "Empty"}
                </option>
              ))}
            </select>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
              <strong>Preview:</strong> {file1Columns.join(", ")}
            </div>
          </div>
        )}

        {/* Header Row Selection for File 2 */}
        {file2RawData.length > 0 && (
          <div className={styles["input-group"]}>
            <label>
              File 2 Header Row (Auto-detected: Row {file2HeaderRow + 1})
            </label>
            <select
              value={file2HeaderRow}
              onChange={(e) =>
                handleFile2HeaderRowChange(parseInt(e.target.value))
              }
            >
              {file2RawData.slice(0, 10).map((_, index) => (
                <option key={index} value={index}>
                  Row {index + 1}:{" "}
                  {file2RawData[index]?.slice(0, 3).join(", ") || "Empty"}
                </option>
              ))}
            </select>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
              <strong>Preview:</strong> {file2Columns.join(", ")}
            </div>
          </div>
        )}

        {file1Columns.length > 0 && file2Columns.length > 0 && (
          <div className={styles["mapping-section"]}>
            <h3>Create Column Mapping</h3>

            <div className={styles["selectors"]}>
              <select
                value={selectedFile1Column}
                onChange={(e) => setSelectedFile1Column(e.target.value)}
              >
                <option value="">Select column from File 1</option>
                {file1Columns.map((col, idx) => (
                  <option key={idx} value={col}>
                    {col}
                  </option>
                ))}
              </select>

              <select
                value={selectedFile2Column}
                onChange={(e) => setSelectedFile2Column(e.target.value)}
              >
                <option value="">Select column from File 2</option>
                {file2Columns.map((col, idx) => (
                  <option key={idx} value={col}>
                    {col}
                  </option>
                ))}
              </select>

              <button onClick={addMapping}>Add Mapping</button>
            </div>

            <div className={styles["mapping-list"]}>
              {/* Group by File 2 so that:
                  - 1 File 1 → 2 File 2: two rows (same File 1 column, different File 2 columns)
                  - 2 File 1 → 1 File 2: one row (multiple File 1 columns as tags → one File 2 column) */}
              {Object.entries(
                mappings.reduce(
                  (acc, map) => {
                    if (!acc[map.file2Column]) {
                      acc[map.file2Column] = [];
                    }
                    acc[map.file2Column].push(map.file1Column);
                    return acc;
                  },
                  {} as Record<string, string[]>,
                ),
              ).map(([file2Col, file1Cols]) => (
                <div
                  key={`${file2Col}-${file1Cols.join(",")}`}
                  className={styles["mapping-item"]}
                >
                  <div className={styles["tags"]}>
                    {file1Cols.map((file1Col) => (
                      <span key={`${file1Col}-${file2Col}`} className={styles["tag"]}>
                        {file1Col}
                        <button
                          className={styles["remove-btn"]}
                          onClick={() => removeMapping(file1Col, file2Col)}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <span style={{ margin: "0 10px", fontWeight: "bold" }}>
                    →
                  </span>
                  <span style={{ fontWeight: "bold", color: "#0078d4" }}>
                    {file2Col}
                  </span>
                </div>
              ))}
            </div>

            <button
              className={styles["save-btn"]}
              onClick={() => {
                saveMappings();
              }}
              disabled={mappings.length === 0 || insuranceName.trim() === ""}
            >
              {isSaving ? <Spinner size="tiny" /> : "Save Mappings"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
