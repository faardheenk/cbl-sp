import React, { useEffect, useState } from "react";
import { useSpContext } from "../../../SpContext";
import "bootstrap/dist/css/bootstrap.min.css";
import PartialMatch from "./PartialMatch";
import { Button, makeStyles } from "@fluentui/react-components";
import { fetchFile } from "../../../lib/fetchFiles";
import { generateMatchKeys } from "../../../lib/generateMatchKeys";
import styles from "../components/Reconciliation.module.scss";

import { IListItemFormUpdateValue } from "@pnp/sp/lists";
import { uploadFiles, uploadExcelFiles } from "../../../lib/uploadFiles";

import Datatable from "./Datatable";
import Header from "../../common/Header";
import { useTasks } from "../../../context/TaskContext";
import { ColumnMappingType } from "../../../typings";

const useStyles = makeStyles({
  container: {
    padding: "2rem",
  },
  partialMatchTable: {
    width: "40%",
  },

  reconciliationContainer: {
    display: "flex",
    justifyContent: "space-around",
  },

  partialHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    margin: "0 1.3rem",
  },
  btn: {
    height: "2rem",
  },
});

function Reconciliation() {
  const { context, sp } = useSpContext();
  const { updateTaskStatus, tasks } = useTasks();
  const [completeMatchFile1Worksheet, setCompleteMatchFile1Worksheet] =
    useState<any[]>([]);
  const [completeMatchFile2Worksheet, setCompleteMatchFile2Worksheet] =
    useState<any[]>([]);
  const [partialMatchesFile1, setPartialMatchesFile1] = useState<any[]>([]);
  const [partialMatchesFile2, setPartialMatchesFile2] = useState<any[]>([]);
  const [selectedPartialRow1, setSelectedPartialRow1] = useState<any[]>([]);
  const [selectedPartialRow2, setSelectedPartialRow2] = useState<any[]>([]);
  const [isClicked, setIsClicked] = useState(false);
  const [noMatchesFile1, setNoMatchesFile1] = useState<any[]>([]);
  const [noMatchesFile2, setNoMatchesFile2] = useState<any[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentManualMatchGroup, setCurrentManualMatchGroup] =
    useState<number>(1);
  const [partialMatchSum1, setPartialMatchSum1] = useState<number>(0);
  const [partialMatchSum2, setPartialMatchSum2] = useState<number>(0);
  const [noMatchSum1, setNoMatchSum1] = useState<number>(0);
  const [noMatchSum2, setNoMatchSum2] = useState<number>(0);
  const classes = useStyles();
  const [cblColumnMappings, setCblColumnMappings] = useState<ColumnMappingType>(
    {
      policyNo: "",
      placingNo: "",
      clientName: "",
      amount: "",
    }
  );
  const [insuranceColumnMappings, setInsuranceColumnMappings] =
    useState<ColumnMappingType>({
      policyNo: "",
      placingNo: "",
      clientName: "",
      amount: "",
    });

  const urlParams = new URLSearchParams(window.location.search);
  const insuranceName = urlParams.get("Insurance");
  // console.log("insurance name >>> ", insuranceName);

  const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25/CBL_SWAN_08_MAY_25.xlsx`;

  // console.log("tasks", tasks);

  useEffect(() => {
    const fetchData = async () => {
      const {
        completeMatchesFile1,
        completeMatchesFile2,
        partialMatchesFile1,
        partialMatchesFile2,
        noMatchesFile1,
        noMatchesFile2,
      } = await fetchFile(url, sp);
      setCompleteMatchFile1Worksheet(completeMatchesFile1);
      setCompleteMatchFile2Worksheet(completeMatchesFile2);
      setPartialMatchesFile1(partialMatchesFile1);
      setPartialMatchesFile2(partialMatchesFile2);
      setNoMatchesFile1(noMatchesFile1);
      setNoMatchesFile2(noMatchesFile2);
    };

    const fetchColumnMappings = async () => {
      const columnMappings = await sp.web.lists.getByTitle("Mappings");

      const [{ ColumnMappings: cbl }]: [{ ColumnMappings: string }] =
        await columnMappings.items.filter(`Title eq 'CBL'`)();

      setCblColumnMappings(JSON.parse(cbl));

      const [{ ColumnMappings: insuranceColumnMappings }]: [
        { ColumnMappings: string }
      ] = await columnMappings.items.filter(
        `Title eq '${insuranceName?.toUpperCase()}'`
      )();

      setInsuranceColumnMappings(JSON.parse(insuranceColumnMappings));
    };

    fetchData();
    fetchColumnMappings();
  }, []);

  // useEffect(() => {
  //   console.log("--- use effect ---");
  //   console.log("selectedPartialRow1", selectedPartialRow1);
  //   console.log("selectedPartialRow2", selectedPartialRow2);
  //   console.log("completeMatchFile1Worksheet", completeMatchFile1Worksheet);
  // }, [selectedPartialRow1, selectedPartialRow2]);

  const addMatchKeys = async (matchingKeys: string) => {
    const list = await sp.web.lists.getByTitle("Matrix");

    const formValues: IListItemFormUpdateValue[] = [
      { FieldName: "Title", FieldValue: matchingKeys },
    ];

    const folderServerRelativePath = `${context.pageContext.web.serverRelativeUrl}/Lists/Matrix/SWAN`;

    await list.addValidateUpdateItemUsingPath(
      formValues,
      folderServerRelativePath
    );
    console.log("Item added successfully");
  };

  const handleMoveToExactMatch = async () => {
    if (selectedPartialRow1.length > 0 && selectedPartialRow2.length > 0) {
      // Update partial matches by clearing data but keeping the rows
      const updatedPartialMatchesFile1 = partialMatchesFile1.map((row) => {
        if (
          selectedPartialRow1.some(
            (selected) => selected.row_id_1 === row.row_id_1
          )
        ) {
          const updatedRow = { ...row };
          Object.keys(updatedRow).forEach((key) => {
            updatedRow[key] = "";
          });
          // updatedRow.match_condition = "manual match";
          return updatedRow;
        }
        return row;
      });

      const updatedPartialMatchesFile2 = partialMatchesFile2.map((row) => {
        if (
          selectedPartialRow2.some(
            (selected) => selected.row_id_2 === row.row_id_2
          )
        ) {
          const updatedRow = { ...row };
          Object.keys(updatedRow).forEach((key) => {
            updatedRow[key] = "";
          });
          // updatedRow.match_condition = "manual match";
          return updatedRow;
        }
        return row;
      });

      setPartialMatchesFile1(updatedPartialMatchesFile1);
      setPartialMatchesFile2(updatedPartialMatchesFile2);

      // Add selected rows to exact matches with group information
      const selectedRowsWithGroup1 = selectedPartialRow1.map((row) => ({
        ...row,
        match_condition: "manual match",
        match_group: currentManualMatchGroup,
      }));

      const selectedRowsWithGroup2 = selectedPartialRow2.map((row) => ({
        ...row,
        match_condition: "manual match",
        match_group: currentManualMatchGroup,
      }));

      let newCompleteMatchFile1Worksheet = [
        ...completeMatchFile1Worksheet,
        ...selectedRowsWithGroup1,
      ];

      let newCompleteMatchFile2Worksheet = [
        ...completeMatchFile2Worksheet,
        ...selectedRowsWithGroup2,
      ];

      // Calculate the difference in length between the two worksheets
      const lengthDiff = Math.abs(
        newCompleteMatchFile1Worksheet.length -
          newCompleteMatchFile2Worksheet.length
      );

      // Create a template for blank rows based on the existing data structure
      const createBlankRow = (template: any) => {
        return Object.keys(template || {}).reduce((acc, key) => {
          acc[key] = "";
          return acc;
        }, {} as Record<string, string>);
      };

      // Add blank rows to make both worksheets equal in length
      if (
        newCompleteMatchFile1Worksheet.length <
        newCompleteMatchFile2Worksheet.length
      ) {
        const template = newCompleteMatchFile1Worksheet[0] || {};
        const blankRows = Array(lengthDiff)
          .fill(null)
          .map(() => createBlankRow(template));
        newCompleteMatchFile1Worksheet = [
          ...newCompleteMatchFile1Worksheet,
          ...blankRows,
        ];
      } else if (
        newCompleteMatchFile2Worksheet.length <
        newCompleteMatchFile1Worksheet.length
      ) {
        const template = newCompleteMatchFile2Worksheet[0] || {};
        const blankRows = Array(lengthDiff)
          .fill(null)
          .map(() => createBlankRow(template));
        newCompleteMatchFile2Worksheet = [
          ...newCompleteMatchFile2Worksheet,
          ...blankRows,
        ];
      }

      setCompleteMatchFile1Worksheet(newCompleteMatchFile1Worksheet);
      setCompleteMatchFile2Worksheet(newCompleteMatchFile2Worksheet);

      // Remove from no matches if present
      setNoMatchesFile1(
        noMatchesFile1.filter(
          (row) =>
            !selectedPartialRow1.some(
              (selected) => selected.row_id_1 === row.row_id_1
            )
        )
      );

      setNoMatchesFile2(
        noMatchesFile2.filter(
          (row) =>
            !selectedPartialRow2.some(
              (selected) => selected.row_id_2 === row.row_id_2
            )
        )
      );

      // await uploadFiles(
      //   sp,
      //   partialMatchesFile1,
      //   partialMatchesFile2,
      //   `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25`
      // );

      // await addMatchKeys(matchKey);

      // // Update task status to Completed when all partial matches are resolved
      // if (
      //   updatedPartialMatchesFile1.length === 0 &&
      //   updatedPartialMatchesFile2.length === 0
      // ) {
      //   const now = new Date();
      //   const month = now.toLocaleString("default", { month: "short" });
      //   const year = now.getFullYear();
      //   const dateStr = `${month} ${year}`;
      //   updateTaskStatus("Swan", dateStr, "Completed");
      // }

      // Increment the manual match group for the next set of matches
      setCurrentManualMatchGroup((prev) => prev + 1);

      setSelectedPartialRow1([]);
      setSelectedPartialRow2([]);
    }
  };

  const handleUpload = async (file1: File, file2: File) => {
    try {
      // const folderPath = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library`;
      // await uploadExcelFiles(sp, [file1, file2], folderPath, [
      //   file1.name,
      //   file2.name,
      // ]);
      alert("This functionality is not available yet");
      setUploadSuccess(true);
    } catch (error) {
      console.error("Error uploading files:", error);
      setUploadError("Failed to upload files. Please try again.");
    }
  };

  return (
    <>
      <div className={styles.container}>
        {/* Exact Matches */}
        <Header
          title="City Broker"
          actionButton={{
            label: "Upload Statements",
            icon: "bi-cloud-arrow-up",
            showUploadModal: true,
            onUpload: handleUpload,
            insuranceOptions: ["Swan", "MUA", "Sicom", "Eagle Insurance"],
          }}
        />

        <div className={styles.partialHeader}>
          <h5>Exact Matches</h5>
          <Button
            className={styles.btn}
            appearance="primary"
            disabled={
              selectedPartialRow1.length === 0 ||
              selectedPartialRow2.length === 0
            }
          >
            Save
          </Button>
        </div>

        <div className={styles.reconciliationContainer}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Excel File 1</h3>
            </div>
            <div className={styles.cardBody}>
              <Datatable data={completeMatchFile1Worksheet} />
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Excel File 2</h3>
            </div>
            <div className={styles.cardBody}>
              <Datatable data={completeMatchFile2Worksheet} />
            </div>
          </div>
        </div>

        {/* Partial Matches Header */}
        <div className={styles.partialHeader}>
          <h5>Partial Matches</h5>
          <Button
            className={styles.btn}
            appearance="primary"
            disabled={
              selectedPartialRow1.length === 0 ||
              selectedPartialRow2.length === 0
            }
            onClick={handleMoveToExactMatch}
          >
            Move to exact match
          </Button>
        </div>

        {/* Partial Matches Bodies */}
        <div className={styles.reconciliationContainer}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Excel File 1</h3>
              <div>
                <span>
                  Total Sum:{" "}
                  {(Number(partialMatchSum1) + Number(noMatchSum1)).toFixed(2)}
                </span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <PartialMatch
                fileType={1}
                partialMatches={partialMatchesFile1}
                setPartialMatchesSetter={setPartialMatchesFile1}
                setSelectedRowData={setSelectedPartialRow1}
                onSumChange={setPartialMatchSum1}
                cblColumnMappings={cblColumnMappings}
                insuranceColumnMappings={insuranceColumnMappings}
              />
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Excel File 2</h3>
              <div>
                <span>
                  Total Sum:{" "}
                  {(Number(partialMatchSum2) + Number(noMatchSum2)).toFixed(2)}
                </span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <PartialMatch
                fileType={2}
                partialMatches={partialMatchesFile2}
                setPartialMatchesSetter={setPartialMatchesFile2}
                setSelectedRowData={setSelectedPartialRow2}
                onSumChange={setPartialMatchSum2}
                cblColumnMappings={cblColumnMappings}
                insuranceColumnMappings={insuranceColumnMappings}
              />
            </div>
          </div>
        </div>

        {/* No Matches */}
        <div>
          <h5>No Matches</h5>
          <div className={styles.reconciliationContainer}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>Excel File 1</h3>
              </div>
              <div className={styles.cardBody}>
                <PartialMatch
                  fileType={1}
                  partialMatches={noMatchesFile1}
                  setPartialMatchesSetter={setNoMatchesFile1}
                  setSelectedRowData={setSelectedPartialRow1}
                  onSumChange={setNoMatchSum1}
                  cblColumnMappings={cblColumnMappings}
                  insuranceColumnMappings={insuranceColumnMappings}
                />
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>Excel File 2</h3>
              </div>
              <div className={styles.cardBody}>
                <PartialMatch
                  fileType={2}
                  partialMatches={noMatchesFile2}
                  setPartialMatchesSetter={setNoMatchesFile2}
                  setSelectedRowData={setSelectedPartialRow2}
                  onSumChange={setNoMatchSum2}
                  cblColumnMappings={cblColumnMappings}
                  insuranceColumnMappings={insuranceColumnMappings}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Reconciliation;
