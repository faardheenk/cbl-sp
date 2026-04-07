import React, { useState } from "react";
import { Row, Col, Image } from "react-bootstrap";
import { Button } from "@fluentui/react-components";
import {
  ArrowUploadRegular,
  ArrowDownloadRegular,
  HomeRegular,
  AddRegular,
} from "@fluentui/react-icons";
import styles from "./Header.module.scss";
import UploadModal from "./UploadModal";
import { useSpContext } from "../../SpContext";
import { uploadExcelFiles } from "../../utils/uploadFiles";
import { useReconciliation } from "../../context/ReconciliationContext";
import { mergeData } from "../../utils/filterData";
import { exportReport } from "../../utils/exportReport";
import * as XLSX from "xlsx";

const Header: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const { context, sp } = useSpContext();
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

  const urlParams = new URLSearchParams(window.location.search);
  const insuranceName = urlParams.get("Insurance");
  const pathParts = window.location.pathname.split("/");
  const pageName = pathParts[pathParts.length - 1].split(".")[0]; // Gets "Reconciliation"
  // console.log("Page name:", pageName);

  const isReconciliation = pageName === "Reconciliation";
  const isOnboarding = pageName === "Onboarding%20Insurance" || pageName === "Onboarding Insurance";

  const insuranceOptions = ["Swan", "MUA", "Sicom", "Eagle Insurance"];

  const handleOpen = () => {
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
  };

  const handleExportReport = () => {
    // TODO: Implement export report functionality
    console.log("Export report clicked");
    const mergedExactMatch = mergeData(exactMatchCBL, exactMatchInsurer);
    const mergedPartialMatch = mergeData(partialMatchCBL, partialMatchInsurer);
    const dynamicBucketSheets = dynamicBuckets.reduce<Record<string, any[]>>(
      (acc, bucket) => {
        const bucketRows = dynamicBucketData[bucket.BucketKey] || {
          cbl: [],
          insurer: [],
        };
        acc[bucket.BucketKey] = mergeData(bucketRows.cbl, bucketRows.insurer);
        return acc;
      },
      {},
    );

    const workbook = exportReport(
      exactMatchSum1,
      exactMatchSum2,
      partialMatchSum1,
      partialMatchSum2,
      noMatchSum1,
      noMatchSum2,
      mergedExactMatch,
      mergedPartialMatch,
      noMatchCBL,
      noMatchInsurer,
      insuranceName || "",
      dynamicBuckets,
      dynamicBucketSheets,
    );

    // Generate filename with current date
    const date = new Date().toISOString().split("T")[0];
    const filename = `reconciliation-report-${date}-${insuranceName}.xlsx`;

    // Write the file and trigger download
    XLSX.writeFile(workbook, filename);

    console.log("Merged exact match:", mergedExactMatch);
  };

  return (
    <>
      <Row className="align-items-center py-2 mb-4">
        <Col>
          <a href={context.pageContext.web.absoluteUrl}>
            <Image
              src={require("../assets/city-broker.png")}
              alt="logo"
              fluid
              style={{
                width: "10%",
                minWidth: "120px",
              }}
            />
          </a>
        </Col>
        <Col className="text-end">
          <div className="d-flex gap-2 justify-content-end">
            {isReconciliation && (
              <>
                <Button
                  as="a"
                  href={context.pageContext.web.absoluteUrl}
                  appearance="primary"
                  className={styles.actionButton}
                  icon={<HomeRegular />}
                >
                  Back to Dashboard
                </Button>
                <Button
                  onClick={handleExportReport}
                  appearance="primary"
                  className={styles.actionButton}
                  icon={<ArrowDownloadRegular />}
                >
                  Export Report
                </Button>
              </>
            )}
            {isOnboarding && (
              <Button
                as="a"
                href={context.pageContext.web.absoluteUrl}
                appearance="primary"
                className={styles.actionButton}
                icon={<HomeRegular />}
              >
                Go to Dashboard
              </Button>
            )}
            {!isReconciliation && !isOnboarding && (
              <>
                <Button
                  appearance="primary"
                  className={styles.actionButton}
                  icon={<AddRegular />}
                  onClick={() => {
                    window.open(
                      `${context.pageContext.web.absoluteUrl}/SitePages/Onboarding Insurance.aspx`,
                      "_blank",
                    );
                  }}
                >
                  Onboard New Insurance
                </Button>
                <Button
                  onClick={handleOpen}
                  appearance="primary"
                  className={styles.actionButton}
                  icon={<ArrowUploadRegular />}
                >
                  Upload Statements
                </Button>
              </>
            )}
          </div>
        </Col>
      </Row>

      <UploadModal
        show={showModal}
        onClose={handleClose}
        // insuranceOptions={insuranceOptions}
      />
    </>
  );
};

export default Header;
