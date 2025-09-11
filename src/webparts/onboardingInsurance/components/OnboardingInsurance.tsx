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

// Define mapping type
interface ColumnMappingType {
  file1Column: string;
  file2Columns: string[];
}

type InsuranceMappingType = {
  InsuranceName: string;
  MappingJson: Record<string, any>;
};

export default function OnboardingInsurance() {
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

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [file1List, setFile1List] = useState<any[]>([]);
  const [file2List, setFile2List] = useState<any[]>([]);

  const file1InputRef = useRef<HTMLInputElement>(null);
  const file2InputRef = useRef<HTMLInputElement>(null);

  const { sp } = useSpContext();

  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);

  // Upload props for File 1
  const file1UploadProps: UploadProps = {
    name: "file",
    accept: ".xlsx,.xls",
    multiple: false,
    fileList: file1List,
    customRequest: ({ file, onSuccess, onError, onProgress }) => {
      console.log("File 1 to be processed:", file);

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
            const columns = sheetData[0] as string[];
            console.log("File 1 Excel columns:", columns);
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
            "Error processing file. Please check if it's a valid Excel file."
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
            const columns = sheetData[0] as string[];
            console.log("File 2 Excel columns:", columns);
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
            "Error processing file. Please check if it's a valid Excel file."
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

  const handleFileUpload = (
    e: ChangeEvent<HTMLInputElement>,
    setColumns: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheetData: any[][] = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
      });
      if (sheetData.length > 0) setColumns(sheetData[0] as string[]);
    };
    reader.readAsArrayBuffer(file);
  };

  // Add a File1 -> File2 mapping
  const addMapping = () => {
    if (!selectedFile1Column || !selectedFile2Column) return;

    const existing = mappings.find(
      (m) => m.file1Column === selectedFile1Column
    );
    if (existing) {
      if (!existing.file2Columns.includes(selectedFile2Column)) {
        existing.file2Columns.push(selectedFile2Column);
        setMappings([...mappings]);
      }
    } else {
      setMappings([
        ...mappings,
        {
          file1Column: selectedFile1Column,
          file2Columns: [selectedFile2Column],
        },
      ]);
    }

    setSelectedFile2Column(""); // reset for next selection
  };

  // Remove a File2 column pill
  const removeFile2Column = (file1Col: string, file2Col: string) => {
    const updated = mappings
      .map((m) =>
        m.file1Column === file1Col
          ? { ...m, file2Columns: m.file2Columns.filter((c) => c !== file2Col) }
          : m
      )
      .filter((m) => m.file2Columns.length > 0); // automatically remove File1 mapping if empty
    setMappings(updated);
  };

  const saveMappings = async () => {
    setIsSaving(true);
    const newMapping: Record<string, string | []> = {};

    const { MappingJson: cblMappingJson } = cblInsuranceMapping;

    mappings.forEach(({ file1Column, file2Columns }) => {
      const genericKey = cblMappingJson[file1Column];
      if (genericKey) {
        if (file2Columns.length === 1) {
          // If only one mapping, keep the generic name as is
          newMapping[file2Columns[0]] = genericKey;
        } else {
          // If multiple, append incremental numbers
          file2Columns.forEach((col, index) => {
            newMapping[col] = `${genericKey}_${index + 1}`;
          });
        }
      }
    });

    sp.web.lists
      .getByTitle("Mappings")
      .items.add({
        Title: insuranceName,
        ColumnMappings: JSON.stringify(newMapping),
      })
      .then(() => {
        console.log("Mappings saved successfully");
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
          { position: "top", intent: "success", timeout: 1000 }
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
          { position: "top", intent: "error", timeout: 1000 }
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
        // Clear file inputs
        if (file1InputRef.current) file1InputRef.current.value = "";
        if (file2InputRef.current) file2InputRef.current.value = "";
      });
  };

  async function fetchExistingInsuranceMappings() {
    const items: any[] = await sp.web.lists.getByTitle("Mappings").items();
    console.log(items);

    const { Title: InsuranceName, ColumnMappings } = items.find(
      (item) => item.Title === "CBL"
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

  useEffect(() => {
    console.log("CBL Insurance Mapping:", cblInsuranceMapping);

    Object.entries(cblInsuranceMapping.MappingJson).forEach(([key, value]) => {
      console.log("Key:", key);
      // console.log("Value:", value);
    });
  }, [cblInsuranceMapping]);

  return (
    <>
      <Toaster toasterId={toasterId} />
      <div className={styles["mapping-container"]}>
        <h2>Insurance Column Mapping</h2>

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
              {mappings.map((map, idx) => (
                <div key={idx} className={styles["mapping-item"]}>
                  <strong>{map.file1Column}</strong> →
                  <div className={styles["tags"]}>
                    {map.file2Columns.map((col, i) => (
                      <span key={i} className={styles["tag"]}>
                        {col}
                        <button
                          className={styles["remove-btn"]}
                          onClick={() =>
                            removeFile2Column(map.file1Column, col)
                          }
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
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
