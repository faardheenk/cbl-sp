import React from "react";
import styles from "./Reconciliation.module.scss";
import { MoneyRegular, DocumentRegular } from "@fluentui/react-icons";
import { countNonBlankRows } from "../../../lib/utils";

type InfoCardProps = {
  exactMatchSum1: number;
  worksheet: any[];
};

function InfoCard({ exactMatchSum1, worksheet }: InfoCardProps) {
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoCardContent}>
        <div className={styles.infoRow}>
          <MoneyRegular className={styles.icon} />
          <div className={styles.infoText}>
            <h4>Total Amount</h4>
            <span className={styles.amount}>{exactMatchSum1.toFixed(2)}</span>
          </div>
        </div>
        <div className={styles.infoRow}>
          <DocumentRegular className={styles.icon} />
          <div className={styles.infoText}>
            <h4>Items</h4>
            <span className={styles.count}>{countNonBlankRows(worksheet)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InfoCard;
