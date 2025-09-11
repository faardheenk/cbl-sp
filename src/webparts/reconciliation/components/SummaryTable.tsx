import React from "react";
import styles from "./Reconciliation.module.scss";
import { MoneyRegular, DocumentRegular } from "@fluentui/react-icons";
import { countNonBlankRows, formatAmount } from "../../../lib/utils";
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
    cblColumnMappings,
    insuranceColumnMappings,
  } = useReconciliation();
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
                <h5>FRCI</h5>
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
                      {countNonBlankRows(exactMatchCBL, cblColumnMappings)}{" "}
                      lines
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
                      {countNonBlankRows(
                        partialMatchCBL,
                        cblColumnMappings
                      )}{" "}
                      lines
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
                      {countNonBlankRows(noMatchCBL, cblColumnMappings)} lines
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
                      {countNonBlankRows(
                        exactMatchInsurer,
                        insuranceColumnMappings
                      )}{" "}
                      lines
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
                      {countNonBlankRows(
                        partialMatchInsurer,
                        insuranceColumnMappings
                      )}{" "}
                      lines
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
                      {countNonBlankRows(
                        noMatchInsurer,
                        insuranceColumnMappings
                      )}{" "}
                      lines
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
