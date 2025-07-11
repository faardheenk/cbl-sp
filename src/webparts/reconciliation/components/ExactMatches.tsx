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
  completeMatchFile1Worksheet: any[];
  completeMatchFile2Worksheet: any[];
  exactMatchSum1: number;
  exactMatchSum2: number;
  insuranceName: string;
  partialMatchesFile1: any[];
  partialMatchesFile2: any[];
  noMatchesFile1: any[];
  noMatchesFile2: any[];
};

function ExactMatches({
  completeMatchFile1Worksheet,
  completeMatchFile2Worksheet,
  exactMatchSum1,
  exactMatchSum2,
  insuranceName,
  partialMatchesFile1,
  partialMatchesFile2,
  noMatchesFile1,
  noMatchesFile2,
}: ExactMatchesProps) {
  const [exactMatchSearch1, setExactMatchSearch1] = useState("");
  const [exactMatchSearch2, setExactMatchSearch2] = useState("");

  return (
    <>
      <div className={styles.partialHeader}>
        <h5>Exact Matches</h5>
        <SaveChanges
          completeMatchFile1Worksheet={completeMatchFile1Worksheet}
          completeMatchFile2Worksheet={completeMatchFile2Worksheet}
          partialMatchesFile1={partialMatchesFile1}
          partialMatchesFile2={partialMatchesFile2}
          noMatchesFile1={noMatchesFile1}
          noMatchesFile2={noMatchesFile2}
        />
      </div>
      <div className={styles.reconciliationContainer}>
        <div className={styles.cardWrapper}>
          <InfoCard
            exactMatchSum1={exactMatchSum1}
            worksheet={completeMatchFile1Worksheet}
          />
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
    </>
  );
}

export default ExactMatches;
