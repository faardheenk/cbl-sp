import React, { useEffect, useState } from "react";
import { useSpContext } from "../../../SpContext";
import "bootstrap/dist/css/bootstrap.min.css";
import { Button, useId, Toaster } from "@fluentui/react-components";
import { fetchFile } from "../../../lib/fetchFiles";
import { generateMatchKeys } from "../../../lib/generateMatchKeys";
import styles from "../components/Reconciliation.module.scss";
import { IListItemFormUpdateValue } from "@pnp/sp/lists";
import Header from "../../common/Header";
import { useTasks } from "../../../context/TaskContext";
import { useChanges } from "../../../context/ChangesContext";
import { ColumnMappingType } from "../../../typings";
import SummaryTable from "./SummaryTable";
import ExactMatches from "./ExactMatches";
import MatchableComponent from "./MatchableComponent";
import {
  addGroupAndCondition,
  calculateSum,
  clearSelectedRows,
  equalizeWorksheetLengths,
  filterOutSelectedRows,
  getNextMatchGroup,
} from "../../../lib/utils";

function Reconciliation() {
  const { context, sp } = useSpContext();
  const { updateTaskStatus, tasks } = useTasks();
  const { setChanges } = useChanges();
  const [completeMatchFile1Worksheet, setCompleteMatchFile1Worksheet] =
    useState<any[]>([]);
  const [completeMatchFile2Worksheet, setCompleteMatchFile2Worksheet] =
    useState<any[]>([]);
  const [partialMatchesFile1, setPartialMatchesFile1] = useState<any[]>([]);
  const [partialMatchesFile2, setPartialMatchesFile2] = useState<any[]>([]);
  const [selectedRow1, setSelectedRow1] = useState<any[]>([]);
  const [selectedRow2, setSelectedRow2] = useState<any[]>([]);
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
  const [exactMatchSum1, setExactMatchSum1] = useState<number>(0);
  const [exactMatchSum2, setExactMatchSum2] = useState<number>(0);

  // Add search states

  const [partialMatchSearch1, setPartialMatchSearch1] = useState("");
  const [partialMatchSearch2, setPartialMatchSearch2] = useState("");
  const [noMatchSearch1, setNoMatchSearch1] = useState("");
  const [noMatchSearch2, setNoMatchSearch2] = useState("");

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

  const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25/Processed.xlsx`;

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

  useEffect(() => {
    const { sum1, sum2 } = calculateSum(
      completeMatchFile1Worksheet,
      completeMatchFile2Worksheet,
      cblColumnMappings,
      insuranceColumnMappings
    );
    setExactMatchSum1(sum1);
    setExactMatchSum2(sum2);
  }, [
    completeMatchFile1Worksheet,
    completeMatchFile2Worksheet,
    cblColumnMappings,
    insuranceColumnMappings,
  ]);

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
    if (selectedRow1.length > 0 && selectedRow2.length > 0) {
      setChanges(true);

      const updatedPartialMatchesFile1 = clearSelectedRows(
        partialMatchesFile1,
        selectedRow1,
        "row_id_1"
      );
      const updatedPartialMatchesFile2 = clearSelectedRows(
        partialMatchesFile2,
        selectedRow2,
        "row_id_2"
      );

      setPartialMatchesFile1(updatedPartialMatchesFile1);
      setPartialMatchesFile2(updatedPartialMatchesFile2);

      const nextMatchGroup = getNextMatchGroup(
        completeMatchFile1Worksheet,
        completeMatchFile2Worksheet
      );

      const selectedRowsWithGroup1 = addGroupAndCondition(
        selectedRow1,
        nextMatchGroup
      );
      const selectedRowsWithGroup2 = addGroupAndCondition(
        selectedRow2,
        nextMatchGroup
      );

      let newCompleteMatchFile1Worksheet = [
        ...completeMatchFile1Worksheet,
        ...selectedRowsWithGroup1,
      ];
      let newCompleteMatchFile2Worksheet = [
        ...completeMatchFile2Worksheet,
        ...selectedRowsWithGroup2,
      ];

      [newCompleteMatchFile1Worksheet, newCompleteMatchFile2Worksheet] =
        equalizeWorksheetLengths(
          newCompleteMatchFile1Worksheet,
          newCompleteMatchFile2Worksheet,
          nextMatchGroup
        );

      setCompleteMatchFile1Worksheet(newCompleteMatchFile1Worksheet);
      setCompleteMatchFile2Worksheet(newCompleteMatchFile2Worksheet);

      setNoMatchesFile1(
        filterOutSelectedRows(noMatchesFile1, selectedRow1, "row_id_1")
      );
      setNoMatchesFile2(
        filterOutSelectedRows(noMatchesFile2, selectedRow2, "row_id_2")
      );

      setSelectedRow1([]);
      setSelectedRow2([]);
    }
  };

  const toasterId = useId("toaster");

  return (
    <>
      <Toaster toasterId={toasterId} />

      <Header />
      <div className={styles.container}>
        {/* Summary Table */}
        <SummaryTable
          exactMatchSum1={exactMatchSum1}
          exactMatchSum2={exactMatchSum2}
          partialMatchSum1={partialMatchSum1}
          partialMatchSum2={partialMatchSum2}
          noMatchSum1={noMatchSum1}
          noMatchSum2={noMatchSum2}
          completeMatchFile1Worksheet={completeMatchFile1Worksheet}
          completeMatchFile2Worksheet={completeMatchFile2Worksheet}
          partialMatchesFile1={partialMatchesFile1}
          partialMatchesFile2={partialMatchesFile2}
          noMatchesFile1={noMatchesFile1}
          noMatchesFile2={noMatchesFile2}
          insuranceName={insuranceName || ""}
        />

        <ExactMatches
          completeMatchFile1Worksheet={completeMatchFile1Worksheet}
          completeMatchFile2Worksheet={completeMatchFile2Worksheet}
          exactMatchSum1={exactMatchSum1}
          exactMatchSum2={exactMatchSum2}
          insuranceName={insuranceName || ""}
          partialMatchesFile1={partialMatchesFile1}
          partialMatchesFile2={partialMatchesFile2}
          noMatchesFile1={noMatchesFile1}
          noMatchesFile2={noMatchesFile2}
        />

        {/* Partial Matches Header */}
        <div className={styles.partialHeader}>
          <div></div>
          <Button
            className={styles.btn}
            appearance="primary"
            disabled={selectedRow1.length === 0 || selectedRow2.length === 0}
            onClick={handleMoveToExactMatch}
          >
            Move to exact match
          </Button>
        </div>

        {/* Partial Matches Bodies */}
        <MatchableComponent
          title="Partial Matches"
          sum1={partialMatchSum1}
          sum2={partialMatchSum2}
          dataFile1={partialMatchesFile1}
          dataFile2={partialMatchesFile2}
          search1={partialMatchSearch1}
          search2={partialMatchSearch2}
          setSearch1={setPartialMatchSearch1}
          setSearch2={setPartialMatchSearch2}
          setSum1={setPartialMatchSum1}
          setSum2={setPartialMatchSum2}
          setMatchesFile1={setPartialMatchesFile1}
          setMatchesFile2={setPartialMatchesFile2}
          setSelectedRowData1={setSelectedRow1}
          setSelectedRowData2={setSelectedRow2}
          cblColumnMappings={cblColumnMappings}
          insuranceColumnMappings={insuranceColumnMappings}
          insuranceName={insuranceName || ""}
        />

        {/* No Matches */}
        <MatchableComponent
          title="No Matches"
          sum1={noMatchSum1}
          sum2={noMatchSum2}
          dataFile1={noMatchesFile1}
          dataFile2={noMatchesFile2}
          search1={noMatchSearch1}
          search2={noMatchSearch2}
          setSearch1={setNoMatchSearch1}
          setSearch2={setNoMatchSearch2}
          setSum1={setNoMatchSum1}
          setSum2={setNoMatchSum2}
          setMatchesFile1={setNoMatchesFile1}
          setMatchesFile2={setNoMatchesFile2}
          setSelectedRowData1={setSelectedRow1}
          setSelectedRowData2={setSelectedRow2}
          cblColumnMappings={cblColumnMappings}
          insuranceColumnMappings={insuranceColumnMappings}
          insuranceName={insuranceName || ""}
        />
      </div>
    </>
  );
}

export default Reconciliation;
