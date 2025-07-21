import React from "react";
import styles from "./Reconciliation.module.scss";
import { MoneyRegular, DocumentRegular } from "@fluentui/react-icons";

import { Input } from "@fluentui/react-components";
import { SearchRegular } from "@fluentui/react-icons";
import Datatable from "./Datatable";
import InfoCard from "./InfoCard";
import SaveChanges from "./SaveChanges";
import { useReconciliation } from "../../../context/ReconciliationContext";

type ExactMatchesProps = {
  insuranceName: string;
};

function ExactMatches({ insuranceName }: ExactMatchesProps) {
  const {
    exactMatchCBL,
    exactMatchInsurer,
    exactMatchSearch1,
    setExactMatchSearch1,
    exactMatchSearch2,
    setExactMatchSearch2,
  } = useReconciliation();

  return (
    <>
      <div className={styles.partialHeader}>
        <h5>Exact Matches</h5>
        <SaveChanges />
      </div>
      <div className={styles.reconciliationContainer}>
        <div className={styles.cardWrapper}>
          <InfoCard type="cbl" />
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
          <InfoCard type="insurer" />
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
