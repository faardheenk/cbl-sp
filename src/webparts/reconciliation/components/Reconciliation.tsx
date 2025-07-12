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
  const [exactMatchCBL, setExactMatchCBL] = useState<any[]>([]);
  const [exactMatchInsurer, setExactMatchInsurer] = useState<any[]>([]);
  const [partialMatchCBL, setPartialMatchCBL] = useState<any[]>([]);
  const [partialMatchInsurer, setPartialMatchInsurer] = useState<any[]>([]);
  const [selectedRowCBL, setSelectedRowCBL] = useState<any[]>([]);
  const [selectedRowInsurer, setSelectedRowInsurer] = useState<any[]>([]);
  const [isClicked, setIsClicked] = useState(false);
  const [noMatchCBL, setNoMatchCBL] = useState<any[]>([]);
  const [noMatchInsurer, setNoMatchInsurer] = useState<any[]>([]);
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

  const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25/output.xlsx`;

  useEffect(() => {
    const fetchData = async () => {
      const {
        exactMatchCBL,
        exactMatchInsurer,
        partialMatchCBL,
        partialMatchInsurer,
        noMatchCBL,
        noMatchInsurer,
      } = await fetchFile(url, sp);
      setExactMatchCBL(exactMatchCBL);
      setExactMatchInsurer(exactMatchInsurer);
      setPartialMatchCBL(partialMatchCBL);
      setPartialMatchInsurer(partialMatchInsurer);
      setNoMatchCBL(noMatchCBL);
      setNoMatchInsurer(noMatchInsurer);
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
      exactMatchCBL,
      exactMatchInsurer,
      cblColumnMappings,
      insuranceColumnMappings
    );
    setExactMatchSum1(sum1);
    setExactMatchSum2(sum2);
  }, [
    exactMatchCBL,
    exactMatchInsurer,
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
    if (selectedRowCBL.length > 0 && selectedRowInsurer.length > 0) {
      setChanges(true);

      const updatedPartialMatchesCBL = clearSelectedRows(
        partialMatchCBL,
        selectedRowCBL,
        "row_id_1"
      );
      const updatedPartialMatchesInsurer = clearSelectedRows(
        partialMatchInsurer,
        selectedRowInsurer,
        "row_id_2"
      );

      setPartialMatchCBL(updatedPartialMatchesCBL);
      setPartialMatchInsurer(updatedPartialMatchesInsurer);

      const nextMatchGroup = getNextMatchGroup(
        exactMatchCBL,
        exactMatchInsurer
      );

      const selectedRowsWithGroup1 = addGroupAndCondition(
        selectedRowCBL,
        nextMatchGroup
      );
      const selectedRowsWithGroup2 = addGroupAndCondition(
        selectedRowInsurer,
        nextMatchGroup
      );

      let newCompleteMatchFile1Worksheet = [
        ...exactMatchCBL,
        ...selectedRowsWithGroup1,
      ];
      let newCompleteMatchFile2Worksheet = [
        ...exactMatchInsurer,
        ...selectedRowsWithGroup2,
      ];

      [newCompleteMatchFile1Worksheet, newCompleteMatchFile2Worksheet] =
        equalizeWorksheetLengths(
          newCompleteMatchFile1Worksheet,
          newCompleteMatchFile2Worksheet,
          nextMatchGroup
        );

      setExactMatchCBL(newCompleteMatchFile1Worksheet);
      setExactMatchInsurer(newCompleteMatchFile2Worksheet);

      setNoMatchCBL(
        filterOutSelectedRows(noMatchCBL, selectedRowCBL, "row_id_1")
      );
      setNoMatchInsurer(
        filterOutSelectedRows(noMatchInsurer, selectedRowInsurer, "row_id_2")
      );

      setSelectedRowCBL([]);
      setSelectedRowInsurer([]);
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
          exactMatchCBL={exactMatchCBL}
          exactMatchInsurer={exactMatchInsurer}
          partialMatchCBL={partialMatchCBL}
          partialMatchInsurer={partialMatchInsurer}
          noMatchCBL={noMatchCBL}
          noMatchInsurer={noMatchInsurer}
          insuranceName={insuranceName || ""}
        />

        <ExactMatches
          exactMatchCBL={exactMatchCBL}
          exactMatchInsurer={exactMatchInsurer}
          exactMatchSum1={exactMatchSum1}
          exactMatchSum2={exactMatchSum2}
          insuranceName={insuranceName || ""}
          partialMatchCBL={partialMatchCBL}
          partialMatchInsurer={partialMatchInsurer}
          noMatchCBL={noMatchCBL}
          noMatchInsurer={noMatchInsurer}
        />

        {/* Partial Matches Header */}
        <div className={styles.partialHeader}>
          <div></div>
          <Button
            className={styles.btn}
            appearance="primary"
            disabled={
              selectedRowCBL.length === 0 || selectedRowInsurer.length === 0
            }
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
          dataFile1={partialMatchCBL}
          dataFile2={partialMatchInsurer}
          search1={partialMatchSearch1}
          search2={partialMatchSearch2}
          setSearch1={setPartialMatchSearch1}
          setSearch2={setPartialMatchSearch2}
          setSum1={setPartialMatchSum1}
          setSum2={setPartialMatchSum2}
          setMatchesFile1={setPartialMatchCBL}
          setMatchesFile2={setPartialMatchInsurer}
          setSelectedRowData1={setSelectedRowCBL}
          setSelectedRowData2={setSelectedRowInsurer}
          cblColumnMappings={cblColumnMappings}
          insuranceColumnMappings={insuranceColumnMappings}
          insuranceName={insuranceName || ""}
        />

        {/* No Matches */}
        <MatchableComponent
          title="No Matches"
          sum1={noMatchSum1}
          sum2={noMatchSum2}
          dataFile1={noMatchCBL}
          dataFile2={noMatchInsurer}
          search1={noMatchSearch1}
          search2={noMatchSearch2}
          setSearch1={setNoMatchSearch1}
          setSearch2={setNoMatchSearch2}
          setSum1={setNoMatchSum1}
          setSum2={setNoMatchSum2}
          setMatchesFile1={setNoMatchCBL}
          setMatchesFile2={setNoMatchInsurer}
          setSelectedRowData1={setSelectedRowCBL}
          setSelectedRowData2={setSelectedRowInsurer}
          cblColumnMappings={cblColumnMappings}
          insuranceColumnMappings={insuranceColumnMappings}
          insuranceName={insuranceName || ""}
        />
      </div>
    </>
  );
}

export default Reconciliation;
