import React, { useEffect } from "react";
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
import { useReconciliation } from "../../../context/ReconciliationContext";
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
  const {
    exactMatchCBL,
    setExactMatchCBL,
    exactMatchInsurer,
    setExactMatchInsurer,
    partialMatchCBL,
    setPartialMatchCBL,
    partialMatchInsurer,
    setPartialMatchInsurer,
    selectedRowCBL,
    setSelectedRowCBL,
    selectedRowInsurer,
    setSelectedRowInsurer,
    noMatchCBL,
    setNoMatchCBL,
    noMatchInsurer,
    setNoMatchInsurer,
    setPartialMatchSum1,
    setPartialMatchSum2,
    setNoMatchSum1,
    setNoMatchSum2,
    setExactMatchSum1,
    setExactMatchSum2,
    cblColumnMappings,
    setCblColumnMappings,
    insuranceColumnMappings,
    setInsuranceColumnMappings,
  } = useReconciliation();

  const urlParams = new URLSearchParams(window.location.search);
  const insuranceName = urlParams.get("Insurance");
  const date = urlParams.get("Date");

  const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/${insuranceName}/${date}/output.xlsx`;
  console.log("URL >>> ", url);
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
      const { sum1, sum2 } = calculateSum(
        exactMatchCBL,
        exactMatchInsurer,
        cblColumnMappings,
        insuranceColumnMappings
      );
      setExactMatchSum1(sum1);
      setExactMatchSum2(sum2);

      const { sum1: partialMatchSum1, sum2: partialMatchSum2 } = calculateSum(
        partialMatchCBL,
        partialMatchInsurer,
        cblColumnMappings,
        insuranceColumnMappings
      );
      setPartialMatchSum1(partialMatchSum1);
      setPartialMatchSum2(partialMatchSum2);

      const { sum1: noMatchSum1, sum2: noMatchSum2 } = calculateSum(
        noMatchCBL,
        noMatchInsurer,
        cblColumnMappings,
        insuranceColumnMappings
      );
      setNoMatchSum1(noMatchSum1);
      setNoMatchSum2(noMatchSum2);
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

    const { sum1: partialMatchSum1, sum2: partialMatchSum2 } = calculateSum(
      partialMatchCBL,
      partialMatchInsurer,
      cblColumnMappings,
      insuranceColumnMappings
    );
    setPartialMatchSum1(partialMatchSum1);
    setPartialMatchSum2(partialMatchSum2);

    const { sum1: noMatchSum1, sum2: noMatchSum2 } = calculateSum(
      noMatchCBL,
      noMatchInsurer,
      cblColumnMappings,
      insuranceColumnMappings
    );
    setNoMatchSum1(noMatchSum1);
    setNoMatchSum2(noMatchSum2);
  }, [
    exactMatchCBL,
    exactMatchInsurer,
    partialMatchCBL,
    partialMatchInsurer,
    noMatchCBL,
    noMatchInsurer,
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
        "idx"
      );
      const updatedPartialMatchesInsurer = clearSelectedRows(
        partialMatchInsurer,
        selectedRowInsurer,
        "idx"
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

      setNoMatchCBL(filterOutSelectedRows(noMatchCBL, selectedRowCBL, "idx"));
      setNoMatchInsurer(
        filterOutSelectedRows(noMatchInsurer, selectedRowInsurer, "idx")
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
        <SummaryTable insuranceName={insuranceName || ""} />

        <ExactMatches insuranceName={insuranceName || ""} />

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
          type="partial"
          insuranceName={insuranceName || ""}
        />

        {/* No Matches */}
        <MatchableComponent
          title="No Matches"
          type="no-match"
          insuranceName={insuranceName || ""}
        />
      </div>
    </>
  );
}

export default Reconciliation;
