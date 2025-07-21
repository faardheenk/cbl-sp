import React from "react";
import styles from "./Reconciliation.module.scss";
import { MoneyRegular, DocumentRegular } from "@fluentui/react-icons";
import { countNonBlankRows, formatAmount } from "../../../lib/utils";
import { useReconciliation } from "../../../context/ReconciliationContext";

type InfoCardProps = {
  type: "cbl" | "insurer";
};

function InfoCard({ type }: InfoCardProps) {
  const {
    exactMatchSum1,
    exactMatchSum2,
    exactMatchCBL,
    exactMatchInsurer,
    cblColumnMappings,
    insuranceColumnMappings,
  } = useReconciliation();

  const sum = type === "cbl" ? exactMatchSum1 : exactMatchSum2;
  const worksheet = type === "cbl" ? exactMatchCBL : exactMatchInsurer;
  const columnMappings =
    type === "cbl" ? cblColumnMappings : insuranceColumnMappings;
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoCardContent}>
        <div className={styles.infoRow}>
          <MoneyRegular className={styles.icon} />
          <div className={styles.infoText}>
            <h4>Total Amount</h4>
            <span className={styles.amount}>Rs {formatAmount(sum)}</span>
          </div>
        </div>
        <div className={styles.infoRow}>
          <DocumentRegular className={styles.icon} />
          <div className={styles.infoText}>
            <h4>Items</h4>
            <span className={styles.count}>
              {countNonBlankRows(worksheet, columnMappings)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InfoCard;
