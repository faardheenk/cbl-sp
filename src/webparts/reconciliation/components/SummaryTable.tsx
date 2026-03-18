import React from "react";
import styles from "./Reconciliation.module.scss";
import { MoneyRegular, DocumentRegular } from "@fluentui/react-icons";
import {
  calculateSum,
  countNonBlankRows,
  formatAmount,
} from "../../../utils/utils";
import { useReconciliation } from "../../../context/ReconciliationContext";

type SummaryTableProps = {
  insuranceName: string;
};
function SummaryTable({ insuranceName }: SummaryTableProps) {
  const {
    exactMatchSum1,
    exactMatchSum2,
    partialMatchSum1,
    partialMatchSum2,
    noMatchSum1,
    noMatchSum2,
    exactMatchCBL,
    exactMatchInsurer,
    partialMatchCBL,
    partialMatchInsurer,
    noMatchCBL,
    noMatchInsurer,
    dynamicBuckets,
    dynamicBucketData,
  } = useReconciliation();

  const dynamicBucketSummaries = dynamicBuckets.map((bucket) => {
    const bucketRows = dynamicBucketData[bucket.BucketKey] || {
      cbl: [],
      insurer: [],
    };
    const sums = calculateSum(bucketRows.cbl, bucketRows.insurer);

    return {
      ...bucket,
      sum1: sums.sum1,
      sum2: sums.sum2,
      count1: countNonBlankRows(bucketRows.cbl),
      count2: countNonBlankRows(bucketRows.insurer),
    };
  });
  return (
    <>
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
                      {countNonBlankRows(exactMatchCBL)} lines
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
                      {countNonBlankRows(partialMatchCBL)} lines
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
                      {countNonBlankRows(noMatchCBL)} lines
                    </span>
                  </div>
                </div>
                {dynamicBucketSummaries.map((bucket) => (
                  <div
                    key={`cbl-${bucket.BucketKey}`}
                    className={styles.summaryTableCell}
                    data-match-type="partial"
                  >
                    <span className={styles.summaryTableLabel}>
                      <MoneyRegular />
                      {bucket.BucketName}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span className={styles.summaryTableValue}>
                        Rs {formatAmount(bucket.sum1)}
                      </span>
                      <span className={styles.summaryTableSubValue}>
                        <DocumentRegular />
                        {bucket.count1} lines
                      </span>
                    </div>
                  </div>
                ))}
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
                      {countNonBlankRows(exactMatchInsurer)} lines
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
                      {countNonBlankRows(partialMatchInsurer)} lines
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
                      {countNonBlankRows(noMatchInsurer)} lines
                    </span>
                  </div>
                </div>
                {dynamicBucketSummaries.map((bucket) => (
                  <div
                    key={`insurer-${bucket.BucketKey}`}
                    className={styles.summaryTableCell}
                    data-match-type="partial"
                  >
                    <span className={styles.summaryTableLabel}>
                      <MoneyRegular />
                      {bucket.BucketName}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span className={styles.summaryTableValue}>
                        Rs {formatAmount(bucket.sum2)}
                      </span>
                      <span className={styles.summaryTableSubValue}>
                        <DocumentRegular />
                        {bucket.count2} lines
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SummaryTable;
