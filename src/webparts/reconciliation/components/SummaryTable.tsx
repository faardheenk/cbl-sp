import React from "react";
import styles from "./Reconciliation.module.scss";
import { MoneyRegular, DocumentRegular } from "@fluentui/react-icons";
import { countNonBlankRows, formatAmount } from "../../../lib/utils";

type SummaryTableProps = {
  exactMatchSum1: number;
  exactMatchSum2: number;
  partialMatchSum1: number;
  partialMatchSum2: number;
  noMatchSum1: number;
  noMatchSum2: number;
  completeMatchFile1Worksheet: any[];
  completeMatchFile2Worksheet: any[];
  partialMatchesFile1: any[];
  partialMatchesFile2: any[];
  noMatchesFile1: any[];
  noMatchesFile2: any[];
  insuranceName: string;
};
function SummaryTable({
  exactMatchSum1,
  exactMatchSum2,
  partialMatchSum1,
  partialMatchSum2,
  noMatchSum1,
  noMatchSum2,
  completeMatchFile1Worksheet,
  completeMatchFile2Worksheet,
  partialMatchesFile1,
  partialMatchesFile2,
  noMatchesFile1,
  noMatchesFile2,
  insuranceName,
}: SummaryTableProps) {
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
    </>
  );
}

export default SummaryTable;
