import React from "react";
import {
  MoneyRegular,
  DocumentRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { Input } from "@fluentui/react-components";
import styles from "./Reconciliation.module.scss";
import { countNonBlankRows, formatAmount } from "../../../lib/utils";
import MatchableDataTable from "./MatchableDataTable";
import { useReconciliation } from "../../../context/ReconciliationContext";

type MatchableComponentProps = {
  insuranceName: string;
  title?: string;
  type: "partial" | "no-match" | "exact";
};

function MatchableComponent({
  insuranceName,
  title,
  type,
}: MatchableComponentProps) {
  const {
    exactMatchCBL,
    setExactMatchCBL,
    exactMatchInsurer,
    setExactMatchInsurer,
    partialMatchCBL,
    setPartialMatchCBL,
    partialMatchInsurer,
    setPartialMatchInsurer,
    noMatchCBL,
    setNoMatchCBL,
    noMatchInsurer,
    setNoMatchInsurer,
    exactMatchSum1,
    setExactMatchSum1,
    exactMatchSum2,
    setExactMatchSum2,
    partialMatchSum1,
    setPartialMatchSum1,
    partialMatchSum2,
    setPartialMatchSum2,
    noMatchSum1,
    setNoMatchSum1,
    noMatchSum2,
    setNoMatchSum2,
    exactMatchSearch1,
    setExactMatchSearch1,
    exactMatchSearch2,
    setExactMatchSearch2,
    partialMatchSearch1,
    setPartialMatchSearch1,
    partialMatchSearch2,
    setPartialMatchSearch2,
    noMatchSearch1,
    setNoMatchSearch1,
    noMatchSearch2,
    setNoMatchSearch2,
    setSelectedRowCBL,
    setSelectedRowInsurer,
    cblColumnMappings,
    insuranceColumnMappings,
  } = useReconciliation();

  // Determine which data to use based on type
  const dataFile1 =
    type === "exact"
      ? exactMatchCBL
      : type === "partial"
      ? partialMatchCBL
      : noMatchCBL;
  const dataFile2 =
    type === "exact"
      ? exactMatchInsurer
      : type === "partial"
      ? partialMatchInsurer
      : noMatchInsurer;
  const sum1 =
    type === "exact"
      ? exactMatchSum1
      : type === "partial"
      ? partialMatchSum1
      : noMatchSum1;
  const sum2 =
    type === "exact"
      ? exactMatchSum2
      : type === "partial"
      ? partialMatchSum2
      : noMatchSum2;
  const search1 =
    type === "exact"
      ? exactMatchSearch1
      : type === "partial"
      ? partialMatchSearch1
      : noMatchSearch1;
  const search2 =
    type === "exact"
      ? exactMatchSearch2
      : type === "partial"
      ? partialMatchSearch2
      : noMatchSearch2;
  const setSearch1 =
    type === "exact"
      ? setExactMatchSearch1
      : type === "partial"
      ? setPartialMatchSearch1
      : setNoMatchSearch1;
  const setSearch2 =
    type === "exact"
      ? setExactMatchSearch2
      : type === "partial"
      ? setPartialMatchSearch2
      : setNoMatchSearch2;
  const setSum1 =
    type === "exact"
      ? setExactMatchSum1
      : type === "partial"
      ? setPartialMatchSum1
      : setNoMatchSum1;
  const setSum2 =
    type === "exact"
      ? setExactMatchSum2
      : type === "partial"
      ? setPartialMatchSum2
      : setNoMatchSum2;
  const setMatchesFile1 =
    type === "exact"
      ? setExactMatchCBL
      : type === "partial"
      ? setPartialMatchCBL
      : setNoMatchCBL;
  const setMatchesFile2 =
    type === "exact"
      ? setExactMatchInsurer
      : type === "partial"
      ? setPartialMatchInsurer
      : setNoMatchInsurer;
  return (
    <>
      <div>
        <div style={{ marginBottom: "1.5rem" }}>
          <h5>{title ? title : ""}</h5>
          <span
            style={{
              color: sum1 + sum2 < 0 ? "red" : "green",
            }}
          >
            Rs {formatAmount(sum1 + sum2)}
          </span>
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
                      Rs {formatAmount(sum1)}
                    </span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <DocumentRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Items</h4>
                    <span className={styles.count}>
                      {countNonBlankRows(dataFile1, cblColumnMappings)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>FRCI</h3>
                <Input
                  type="text"
                  placeholder="Search..."
                  value={search1}
                  onChange={(e) => setSearch1(e.target.value)}
                  contentBefore={<SearchRegular />}
                  style={{ width: "200px" }}
                />
              </div>
              <div className={styles.cardBody}>
                <MatchableDataTable
                  fileType={1}
                  partialMatches={dataFile1}
                  setPartialMatchesSetter={setMatchesFile1}
                  setSelectedRowData={setSelectedRowCBL}
                  onSumChange={setSum1}
                  cblColumnMappings={cblColumnMappings}
                  insuranceColumnMappings={insuranceColumnMappings}
                  filterText={search1}
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
                      Rs {formatAmount(sum2)}
                    </span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <DocumentRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Items</h4>
                    <span className={styles.count}>
                      {countNonBlankRows(dataFile2, insuranceColumnMappings)}
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
                  value={search2}
                  onChange={(e) => setSearch2(e.target.value)}
                  contentBefore={<SearchRegular />}
                  style={{ width: "200px" }}
                />
              </div>
              <div className={styles.cardBody}>
                <MatchableDataTable
                  fileType={2}
                  partialMatches={dataFile2}
                  setPartialMatchesSetter={setMatchesFile2}
                  setSelectedRowData={setSelectedRowInsurer}
                  onSumChange={setSum2}
                  cblColumnMappings={cblColumnMappings}
                  insuranceColumnMappings={insuranceColumnMappings}
                  filterText={search2}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default MatchableComponent;
