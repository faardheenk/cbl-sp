import React, { useEffect, useState } from "react";
import { useSpContext } from "../../../SpContext";

import PartialMatch from "./PartialMatch";
import { Button, makeStyles } from "@fluentui/react-components";
import { fetchFile } from "../../../lib/fetchFiles";
import { generateMatchKeys } from "../../../lib/generateMatchKeys";
import styles from "../components/Reconciliation.module.scss";

import { IListItemFormUpdateValue } from "@pnp/sp/lists";
import { uploadFiles } from "../../../lib/uploadFiles";

import Datatable from "./Datatable";

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

type Items = {
  Title: string;
};

function Reconciliation() {
  const { context, sp } = useSpContext();
  const [completeMatchFile1Worksheet, setCompleteMatchFile1Worksheet] =
    useState<any[]>([]);
  const [completeMatchFile2Worksheet, setCompleteMatchFile2Worksheet] =
    useState<any[]>([]);
  const [partialMatchesFile1, setPartialMatchesFile1] = useState<any[]>([]);
  const [partialMatchesFile2, setPartialMatchesFile2] = useState<any[]>([]);
  const [selectedPartialRow1, setSelectedPartialRow1] = useState<any>(null);
  const [selectedPartialRow2, setSelectedPartialRow2] = useState<any>(null);
  const [isClicked, setIsClicked] = useState(false);
  const [noMatchesFile1, setNoMatchesFile1] = useState<any[]>([]);
  const [noMatchesFile2, setNoMatchesFile2] = useState<any[]>([]);
  const classes = useStyles();

  const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25/CBL_SWAN_25_APR_25.xlsx`;

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

  function handleMoveToExactMatch() {
    if (selectedPartialRow1 && selectedPartialRow2) {
      const row1 = selectedPartialRow1;
      const row2 = selectedPartialRow2;

      const matchKey = generateMatchKeys(row1, row2, {
        "placing no": "BRKREF",
        amount: "DEBAMT",
      });

      const updatedPartialMatchesFile1 = partialMatchesFile1.filter(
        (row) => row.row_id_1 !== row1.row_id_1
      );
      setPartialMatchesFile1(updatedPartialMatchesFile1);

      const updatedPartialMatchesFile2 = partialMatchesFile2.filter(
        (row) => row.row_id_2 !== row2.row_id_2
      );
      setPartialMatchesFile2(updatedPartialMatchesFile2);

      const updatedPartialFiles = uploadFiles(
        sp,
        partialMatchesFile1,
        partialMatchesFile2,
        `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25`
      ).then(() => {
        console.log("Files overwritten successfully");
      });

      addMatchKeys(matchKey).then(() => {
        setSelectedPartialRow1(null);
        setSelectedPartialRow2(null);
      });
    }
  }

  return (
    <div className={styles.container}>
      {/* Exact Matches */}
      <div>
        <h1>Exact Matches</h1>
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
        <h1>Partial Matches</h1>
        <Button
          className={styles.btn}
          appearance="primary"
          disabled={!selectedPartialRow1 || !selectedPartialRow2}
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
        <h1>No Matches</h1>
        <div className={styles.reconciliationContainer}>
          <div className={styles.card}>
            <h3>Excel File 1</h3>
            <div className={styles.cardBody}>
              <Datatable data={noMatchesFile1} />
            </div>
          </div>
          <div className={styles.card}>
            <h3>Excel File 2</h3>
            <div className={styles.cardBody}>
              <Datatable data={noMatchesFile2} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reconciliation;
