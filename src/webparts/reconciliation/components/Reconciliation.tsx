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
  const classes = useStyles();

  const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25/CBL_SWAN_07_MAY_25.xlsx`;

  console.log("tasks", tasks);

  useEffect(() => {
    const fetchData = async () => {
      const {
        completeMatchFile1Worksheet,
        completeMatchFile2Worksheet,
        partialMatchFile1Worksheet,
        partialMatchFile2Worksheet,
        noMatchFile1Worksheet,
        noMatchFile2Worksheet,
      } = await fetchFile(url, sp);
      setCompleteMatchFile1Worksheet(completeMatchFile1Worksheet);
      setCompleteMatchFile2Worksheet(completeMatchFile2Worksheet);
      setPartialMatchesFile1(partialMatchFile1Worksheet);
      setPartialMatchesFile2(partialMatchFile2Worksheet);
      setNoMatchesFile1(noMatchFile1Worksheet);
      setNoMatchesFile2(noMatchFile2Worksheet);
    };
    fetchData();
  }, []);

  useEffect(() => {
    console.log("selectedPartialRow1", selectedPartialRow1);
    console.log("selectedPartialRow2", selectedPartialRow2);
  }, [selectedPartialRow1, selectedPartialRow2]);

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
      // Move all selected rows from partial matches to exact matches
      const updatedPartialMatchesFile1 = partialMatchesFile1.filter(
        (row) =>
          !selectedPartialRow1.some(
            (selected) => selected.row_id_1 === row.row_id_1
          )
      );

      console.log("updatedPartialMatchesFile1", updatedPartialMatchesFile1);

      setPartialMatchesFile1(updatedPartialMatchesFile1);
      setCompleteMatchFile1Worksheet([
        ...completeMatchFile1Worksheet,
        ...selectedPartialRow1,
      ]);

      const updatedPartialMatchesFile2 = partialMatchesFile2.filter(
        (row) =>
          !selectedPartialRow2.some(
            (selected) => selected.row_id_2 === row.row_id_2
          )
      );
      setPartialMatchesFile2(updatedPartialMatchesFile2);

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

      setCompleteMatchFile2Worksheet([
        ...completeMatchFile2Worksheet,
        ...selectedPartialRow2,
      ]);

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

        <div>
          <h5>Exact Matches</h5>
          <div className={styles.reconciliationContainer}>
            <div className={styles.card}>
              <h3>Excel File 1</h3>
              <div className={styles.cardBody}>
                <Datatable data={completeMatchFile1Worksheet} />
              </div>
            </div>
            <div className={styles.card}>
              <h3>Excel File 2</h3>
              <div className={styles.cardBody}>
                <Datatable data={completeMatchFile2Worksheet} />
              </div>
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
            <h3>Excel File 1</h3>
            <div className={styles.cardBody}>
              <PartialMatch
                partialMatches={partialMatchesFile1}
                setPartialMatchesSetter={setPartialMatchesFile1}
                setSelectedRowData={setSelectedPartialRow1}
              />
            </div>
          </div>
          <div className={styles.card}>
            <h3>Excel File 2</h3>
            <div className={styles.cardBody}>
              <PartialMatch
                partialMatches={partialMatchesFile2}
                setPartialMatchesSetter={setPartialMatchesFile2}
                setSelectedRowData={setSelectedPartialRow2}
              />
            </div>
          </div>
        </div>

        {/* No Matches */}
        <div>
          <h5>No Matches</h5>
          <div className={styles.reconciliationContainer}>
            <div className={styles.card}>
              <h3>Excel File 1</h3>
              <div className={styles.cardBody}>
                {/* <Datatable data={noMatchesFile1} />
                 */}
                <PartialMatch
                  partialMatches={noMatchesFile1}
                  setPartialMatchesSetter={setNoMatchesFile1}
                  setSelectedRowData={setSelectedPartialRow1}
                />
              </div>
            </div>
            <div className={styles.card}>
              <h3>Excel File 2</h3>
              <div className={styles.cardBody}>
                <PartialMatch
                  partialMatches={noMatchesFile2}
                  setPartialMatchesSetter={setNoMatchesFile2}
                  setSelectedRowData={setSelectedPartialRow2}
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
