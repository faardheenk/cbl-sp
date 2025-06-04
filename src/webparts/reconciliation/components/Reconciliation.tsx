import React, { useEffect, useState } from "react";
import { useSpContext } from "../../../SpContext";
import "bootstrap/dist/css/bootstrap.min.css";
import PartialMatch from "./PartialMatch";
import {
  Button,
  makeStyles,
  Spinner,
  Toast,
  ToastTitle,
  useId,
  useToastController,
  Toaster,
  ToastBody,
  Input,
} from "@fluentui/react-components";
import {
  SaveRegular,
  MoneyRegular,
  DocumentRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { fetchFile } from "../../../lib/fetchFiles";
import { generateMatchKeys } from "../../../lib/generateMatchKeys";
import styles from "../components/Reconciliation.module.scss";

import { IListItemFormUpdateValue } from "@pnp/sp/lists";
import { uploadFiles, uploadExcelFiles } from "../../../lib/uploadFiles";

import Datatable from "./Datatable";
import Header from "../../common/Header";
import { useTasks } from "../../../context/TaskContext";
import { ColumnMappingType } from "../../../typings";
import { saveExcel } from "../../../lib/saveExcel";
import { cleanData } from "../../../lib/cleanData";

const useStyles = makeStyles({
  container: {
    padding: "2rem",
  },
  summaryTable: {
    width: "100%",
    marginBottom: "2rem",
    backgroundColor: "white",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
  summaryTableHeader: {
    backgroundColor: "#f8f9fa",
    padding: "1rem",
    borderBottom: "1px solid #dee2e6",
  },
  summaryTableBody: {
    padding: "1rem",
  },
  summaryTableRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "1rem",
    padding: "1rem",
    borderBottom: "1px solid #dee2e6",
    "&:last-child": {
      borderBottom: "none",
    },
  },
  summaryTableCell: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  summaryTableLabel: {
    fontSize: "0.875rem",
    color: "#6c757d",
    fontWeight: "500",
  },
  summaryTableValue: {
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "#212529",
  },
  summaryTableSubValue: {
    fontSize: "0.875rem",
    color: "#6c757d",
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
  cardWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  infoCard: {
    backgroundColor: "#f0f0f0",
    padding: "0.5rem 1rem",
    borderRadius: "0.25rem",
    marginBottom: "1rem",
  },
  infoCardContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  amount: {
    fontSize: "1.5rem",
    fontWeight: "bold",
  },
  count: {
    fontSize: "0.8rem",
    color: "#666",
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
  },
  icon: {
    marginRight: "0.5rem",
  },
  infoText: {
    display: "flex",
    flexDirection: "column",
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
  const [exactMatchSum1, setExactMatchSum1] = useState<number>(0);
  const [exactMatchSum2, setExactMatchSum2] = useState<number>(0);
  const classes = useStyles();
  const [changes, setChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Add search states
  const [exactMatchSearch1, setExactMatchSearch1] = useState("");
  const [exactMatchSearch2, setExactMatchSearch2] = useState("");
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
  // console.log("insurance name >>> ", insuranceName);

  // const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25/CBL_SWAN_09_MAY_25.xlsx`;
  const url = `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25/Processed.xlsx`;

  // console.log("tasks", tasks);

  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);

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
    console.log("--- use effect ---");

    console.log("completeMatchFile1Worksheet", completeMatchFile1Worksheet);
    console.log("completeMatchFile2Worksheet", completeMatchFile2Worksheet);
  }, [completeMatchFile1Worksheet, completeMatchFile2Worksheet]);

  useEffect(() => {
    // Calculate exact match sums whenever the worksheets change
    const calculateExactMatchSums = () => {
      const sum1 = completeMatchFile1Worksheet.reduce((acc, row) => {
        const amount = isNaN(row[cblColumnMappings.amount])
          ? 0
          : Number(row[cblColumnMappings.amount]);
        return acc + amount;
      }, 0);

      const sum2 = completeMatchFile2Worksheet.reduce((acc, row) => {
        const amount = isNaN(row[insuranceColumnMappings.amount])
          ? 0
          : Number(row[insuranceColumnMappings.amount]);
        return acc + amount;
      }, 0);

      setExactMatchSum1(sum1);
      setExactMatchSum2(sum2);
    };

    calculateExactMatchSums();
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
    if (selectedPartialRow1.length > 0 && selectedPartialRow2.length > 0) {
      setChanges(true);
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
          return updatedRow;
        }
        return row;
      });

      setPartialMatchesFile1(updatedPartialMatchesFile1);
      setPartialMatchesFile2(updatedPartialMatchesFile2);

      // Get the last row's match_group from both worksheets
      const lastMatchGroup1 =
        completeMatchFile1Worksheet.length > 0
          ? completeMatchFile1Worksheet[completeMatchFile1Worksheet.length - 1]
              .match_group
          : 0;
      const lastMatchGroup2 =
        completeMatchFile2Worksheet.length > 0
          ? completeMatchFile2Worksheet[completeMatchFile2Worksheet.length - 1]
              .match_group
          : 0;

      // Use the higher match_group value to ensure alternation
      const lastMatchGroup = Math.max(lastMatchGroup1, lastMatchGroup2);
      const nextMatchGroup = lastMatchGroup % 2 === 0 ? 1 : 2;

      // Add selected rows to exact matches with alternating group information
      const selectedRowsWithGroup1 = selectedPartialRow1.map((row) => ({
        ...row,
        match_condition: "manual match",
        match_group: nextMatchGroup,
      }));

      const selectedRowsWithGroup2 = selectedPartialRow2.map((row) => ({
        ...row,
        match_condition: "manual match",
        match_group: nextMatchGroup,
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
          acc["match_condition"] = "manual match";
          acc["match_group"] = nextMatchGroup.toString();
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

      setSelectedPartialRow1([]);
      setSelectedPartialRow2([]);
    }
  };

  const countNonBlankRows = (rows: any[]) => {
    return rows.filter((row) => {
      // Get all keys except match_condition and match_group
      const relevantKeys = Object.keys(row).filter(
        (key) => key !== "match_condition" && key !== "match_group"
      );

      // Check if any of the relevant fields have non-empty values
      return relevantKeys.some((key) => {
        const value = row[key];
        return value !== undefined && value !== null && value !== "";
      });
    }).length;
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  console.log(
    "work book sheet 1 number of lines",
    countNonBlankRows(completeMatchFile1Worksheet)
  );
  console.log(
    "work book sheet 2 number of lines",
    countNonBlankRows(completeMatchFile2Worksheet)
  );

  return (
    <>
      <Toaster toasterId={toasterId} />

      <Header />
      <div className={styles.container}>
        {/* Summary Table */}
        <div className={styles.summaryTable}>
          <div className={styles.summaryTableHeader}>
            <h4>Reconciliation Summary</h4>
          </div>
          <div className={styles.summaryTableBody}>
            <div className={styles.summaryTableRow}>
              <div className={styles.summaryTableSection}>
                <div className={styles.summaryTableSectionHeader}>
                  <h5>CBL</h5>
                </div>
                <div className={styles.summaryTableGrid}>
                  <div
                    className={styles.summaryTableCell}
                    data-match-type="exact"
                  >
                    <span className={styles.summaryTableLabel}>
                      <MoneyRegular />
                      Exact Matches
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span className={styles.summaryTableValue}>
                        Rs {formatAmount(exactMatchSum1)}
                      </span>
                      <span className={styles.summaryTableSubValue}>
                        <DocumentRegular />
                        {countNonBlankRows(completeMatchFile1Worksheet)} lines
                      </span>
                    </div>
                  </div>
                  <div
                    className={styles.summaryTableCell}
                    data-match-type="partial"
                  >
                    <span className={styles.summaryTableLabel}>
                      <MoneyRegular />
                      Partial Matches
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span className={styles.summaryTableValue}>
                        Rs {formatAmount(partialMatchSum1)}
                      </span>
                      <span className={styles.summaryTableSubValue}>
                        <DocumentRegular />
                        {countNonBlankRows(partialMatchesFile1)} lines
                      </span>
                    </div>
                  </div>
                  <div
                    className={styles.summaryTableCell}
                    data-match-type="no-match"
                  >
                    <span className={styles.summaryTableLabel}>
                      <MoneyRegular />
                      No Matches
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span className={styles.summaryTableValue}>
                        Rs {formatAmount(noMatchSum1)}
                      </span>
                      <span className={styles.summaryTableSubValue}>
                        <DocumentRegular />
                        {countNonBlankRows(noMatchesFile1)} lines
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.summaryTableSection}>
                <div className={styles.summaryTableSectionHeader}>
                  <h5>{insuranceName}</h5>
                </div>
                <div className={styles.summaryTableGrid}>
                  <div
                    className={styles.summaryTableCell}
                    data-match-type="exact"
                  >
                    <span className={styles.summaryTableLabel}>
                      <MoneyRegular />
                      Exact Matches
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span className={styles.summaryTableValue}>
                        Rs {formatAmount(exactMatchSum2)}
                      </span>
                      <span className={styles.summaryTableSubValue}>
                        <DocumentRegular />
                        {countNonBlankRows(completeMatchFile2Worksheet)} lines
                      </span>
                    </div>
                  </div>
                  <div
                    className={styles.summaryTableCell}
                    data-match-type="partial"
                  >
                    <span className={styles.summaryTableLabel}>
                      <MoneyRegular />
                      Partial Matches
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span className={styles.summaryTableValue}>
                        Rs {formatAmount(partialMatchSum2)}
                      </span>
                      <span className={styles.summaryTableSubValue}>
                        <DocumentRegular />
                        {countNonBlankRows(partialMatchesFile2)} lines
                      </span>
                    </div>
                  </div>
                  <div
                    className={styles.summaryTableCell}
                    data-match-type="no-match"
                  >
                    <span className={styles.summaryTableLabel}>
                      <MoneyRegular />
                      No Matches
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span className={styles.summaryTableValue}>
                        Rs {formatAmount(noMatchSum2)}
                      </span>
                      <span className={styles.summaryTableSubValue}>
                        <DocumentRegular />
                        {countNonBlankRows(noMatchesFile2)} lines
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Exact Matches */}
        <div className={styles.partialHeader}>
          <h5>Exact Matches</h5>
          <Button
            icon={
              isSaving ? <Spinner size="tiny" /> : <SaveRegular fontSize={24} />
            }
            size="small"
            className={styles.btn}
            appearance="primary"
            disabled={!changes || isSaving}
            onClick={async () => {
              setChanges(false);
              setIsSaving(true);
              const res = await saveExcel(
                sp,
                cleanData(
                  completeMatchFile1Worksheet,
                  completeMatchFile2Worksheet
                ),
                cleanData(partialMatchesFile1, partialMatchesFile2),
                noMatchesFile1,
                noMatchesFile2,
                `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25`
              );
              if (res.status === 200) {
                dispatchToast(
                  <Toast className="bg-success text-white rounded-3">
                    <ToastTitle>Saved Successfully</ToastTitle>
                  </Toast>,
                  { position: "top", intent: "success" }
                );
                setIsSaving(false);
              } else {
                dispatchToast(
                  <Toast className="bg-danger text-white rounded-3">
                    <ToastTitle>Error saving changes</ToastTitle>
                    <ToastBody className="fs-3">
                      Cannot save changes because the excel file is open
                    </ToastBody>
                  </Toast>,
                  { position: "top", intent: "error" }
                );
                setIsSaving(false);
              }
            }}
          >
            Save
          </Button>
        </div>

        <div className={styles.reconciliationContainer}>
          <div className={styles.cardWrapper}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardContent}>
                <div className={styles.infoRow}>
                  <MoneyRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Total Amount</h4>
                    <span className={styles.amount}>
                      {exactMatchSum1.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <DocumentRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Items</h4>
                    <span className={styles.count}>
                      {countNonBlankRows(completeMatchFile1Worksheet)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>CBL</h3>
                <Input
                  type="text"
                  placeholder="Search..."
                  value={exactMatchSearch1}
                  onChange={(e) => setExactMatchSearch1(e.target.value)}
                  contentBefore={<SearchRegular />}
                  style={{ width: "200px" }}
                />
              </div>
              <div className={styles.cardBody}>
                <Datatable
                  data={completeMatchFile1Worksheet}
                  filterText={exactMatchSearch1}
                />
              </div>
            </div>
          </div>
          <div className={styles.cardWrapper}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardContent}>
                <div className={styles.infoRow}>
                  <MoneyRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Total Amount</h4>
                    <span className={styles.amount}>
                      {exactMatchSum2.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <DocumentRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Items</h4>
                    <span className={styles.count}>
                      {countNonBlankRows(completeMatchFile2Worksheet)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>{insuranceName}</h3>
                <Input
                  type="text"
                  placeholder="Search..."
                  value={exactMatchSearch2}
                  onChange={(e) => setExactMatchSearch2(e.target.value)}
                  contentBefore={<SearchRegular />}
                  style={{ width: "200px" }}
                />
              </div>
              <div className={styles.cardBody}>
                <Datatable
                  data={completeMatchFile2Worksheet}
                  filterText={exactMatchSearch2}
                />
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
          <div className={styles.cardWrapper}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardContent}>
                <div className={styles.infoRow}>
                  <MoneyRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Total Amount</h4>
                    <span className={styles.amount}>
                      {(Number(partialMatchSum1) + Number(noMatchSum1)).toFixed(
                        2
                      )}
                    </span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <DocumentRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Items</h4>
                    <span className={styles.count}>
                      {countNonBlankRows(partialMatchesFile1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>CBL</h3>
                <Input
                  type="text"
                  placeholder="Search..."
                  value={partialMatchSearch1}
                  onChange={(e) => setPartialMatchSearch1(e.target.value)}
                  contentBefore={<SearchRegular />}
                  style={{ width: "200px" }}
                />
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
                  filterText={partialMatchSearch1}
                />
              </div>
            </div>
          </div>
          <div className={styles.cardWrapper}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardContent}>
                <div className={styles.infoRow}>
                  <MoneyRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Total Amount</h4>
                    <span className={styles.amount}>
                      {(Number(partialMatchSum2) + Number(noMatchSum2)).toFixed(
                        2
                      )}
                    </span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <DocumentRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Items</h4>
                    <span className={styles.count}>
                      {countNonBlankRows(partialMatchesFile2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>{insuranceName}</h3>
                <Input
                  type="text"
                  placeholder="Search..."
                  value={partialMatchSearch2}
                  onChange={(e) => setPartialMatchSearch2(e.target.value)}
                  contentBefore={<SearchRegular />}
                  style={{ width: "200px" }}
                />
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
                  filterText={partialMatchSearch2}
                />
              </div>
            </div>
          </div>
        </div>

        {/* No Matches */}
        <div>
          <h5>No Matches</h5>
          <div className={styles.reconciliationContainer}>
            <div className={styles.cardWrapper}>
              <div className={styles.infoCard}>
                <div className={styles.infoCardContent}>
                  <div className={styles.infoRow}>
                    <MoneyRegular className={styles.icon} />
                    <div className={styles.infoText}>
                      <h4>Total Amount</h4>
                      <span className={styles.amount}>
                        {noMatchSum1.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.infoRow}>
                    <DocumentRegular className={styles.icon} />
                    <div className={styles.infoText}>
                      <h4>Items</h4>
                      <span className={styles.count}>
                        {countNonBlankRows(noMatchesFile1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>CBL</h3>
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={noMatchSearch1}
                    onChange={(e) => setNoMatchSearch1(e.target.value)}
                    contentBefore={<SearchRegular />}
                    style={{ width: "200px" }}
                  />
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
                    filterText={noMatchSearch1}
                  />
                </div>
              </div>
            </div>
            <div className={styles.cardWrapper}>
              <div className={styles.infoCard}>
                <div className={styles.infoCardContent}>
                  <div className={styles.infoRow}>
                    <MoneyRegular className={styles.icon} />
                    <div className={styles.infoText}>
                      <h4>Total Amount</h4>
                      <span className={styles.amount}>
                        {noMatchSum2.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.infoRow}>
                    <DocumentRegular className={styles.icon} />
                    <div className={styles.infoText}>
                      <h4>Items</h4>
                      <span className={styles.count}>
                        {countNonBlankRows(noMatchesFile2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>{insuranceName}</h3>
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={noMatchSearch2}
                    onChange={(e) => setNoMatchSearch2(e.target.value)}
                    contentBefore={<SearchRegular />}
                    style={{ width: "200px" }}
                  />
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
                    filterText={noMatchSearch2}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Reconciliation;
