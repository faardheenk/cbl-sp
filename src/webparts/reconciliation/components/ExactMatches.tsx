import React, { useState } from "react";
import styles from "./Reconciliation.module.scss";
import { MoneyRegular, DocumentRegular } from "@fluentui/react-icons";
import { countNonBlankRows } from "../../../lib/utils";
import { Input } from "@fluentui/react-components";
import { SearchRegular } from "@fluentui/react-icons";
import Datatable from "./Datatable";
import InfoCard from "./InfoCard";
import SaveChanges from "./SaveChanges";

type ExactMatchesProps = {
  exactMatchCBL: any[];
  exactMatchInsurer: any[];
  exactMatchSum1: number;
  exactMatchSum2: number;
  insuranceName: string;
  partialMatchCBL: any[];
  partialMatchInsurer: any[];
  noMatchCBL: any[];
  noMatchInsurer: any[];
};

function ExactMatches({
  exactMatchCBL,
  exactMatchInsurer,
  exactMatchSum1,
  exactMatchSum2,
  insuranceName,
  partialMatchCBL,
  partialMatchInsurer,
  noMatchCBL,
  noMatchInsurer,
}: ExactMatchesProps) {
  const [exactMatchSearch1, setExactMatchSearch1] = useState("");
  const [exactMatchSearch2, setExactMatchSearch2] = useState("");

  return (
    <>
      <div className={styles.partialHeader}>
        <h5>Exact Matches</h5>
        <SaveChanges
          exactMatchCBL={exactMatchCBL}
          exactMatchInsurer={exactMatchInsurer}
          partialMatchCBL={partialMatchCBL}
          partialMatchInsurer={partialMatchInsurer}
          noMatchCBL={noMatchCBL}
          noMatchInsurer={noMatchInsurer}
        />
      </div>
      <div className={styles.reconciliationContainer}>
        <div className={styles.cardWrapper}>
          <InfoCard exactMatchSum1={exactMatchSum1} worksheet={exactMatchCBL} />
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
              <Datatable data={exactMatchCBL} filterText={exactMatchSearch1} />
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
                    {countNonBlankRows(exactMatchInsurer)}
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
                data={exactMatchInsurer}
                filterText={exactMatchSearch2}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ExactMatches;
