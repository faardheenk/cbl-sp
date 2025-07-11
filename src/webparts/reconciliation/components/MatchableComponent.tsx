import React from "react";
import {
  MoneyRegular,
  DocumentRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { Input } from "@fluentui/react-components";
import styles from "./Reconciliation.module.scss";
import { countNonBlankRows } from "../../../lib/utils";
import MatchableDataTable from "./MatchableDataTable";

type MatchableComponentProps = {
  sum1: number;
  sum2: number;
  dataFile1: any[];
  dataFile2: any[];
  search1: string;
  search2: string;
  setSearch1: (value: string) => void;
  setSearch2: (value: string) => void;
  setSum1: (value: number) => void;
  setSum2: (value: number) => void;
  setMatchesFile1: (value: any[]) => void;
  setMatchesFile2: (value: any[]) => void;
  setSelectedRowData1: (value: any) => void;
  setSelectedRowData2: (value: any) => void;
  cblColumnMappings: any;
  insuranceColumnMappings: any;
  insuranceName: string;
  title?: string;
};

function MatchableComponent({
  sum1,
  sum2,
  dataFile1,
  dataFile2,
  search1,
  search2,
  setSearch1,
  setSearch2,
  setSum1,
  setSum2,
  setMatchesFile1,
  setMatchesFile2,
  setSelectedRowData1,
  setSelectedRowData2,
  cblColumnMappings,
  insuranceColumnMappings,
  insuranceName,
  title,
}: MatchableComponentProps) {
  return (
    <>
      <div>
        <h5>{title ? title : ""}</h5>
        <div className={styles.reconciliationContainer}>
          <div className={styles.cardWrapper}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardContent}>
                <div className={styles.infoRow}>
                  <MoneyRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Total Amount</h4>
                    <span className={styles.amount}>{sum1.toFixed(2)}</span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <DocumentRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Items</h4>
                    <span className={styles.count}>
                      {countNonBlankRows(dataFile1)}
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
                  setSelectedRowData={setSelectedRowData1}
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
                    <span className={styles.amount}>{sum2.toFixed(2)}</span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <DocumentRegular className={styles.icon} />
                  <div className={styles.infoText}>
                    <h4>Items</h4>
                    <span className={styles.count}>
                      {countNonBlankRows(dataFile2)}
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
                  setSelectedRowData={setSelectedRowData2}
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
