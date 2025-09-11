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
import { uploadExcelFiles } from "../../lib/uploadFiles";
import { useReconciliation } from "../../context/ReconciliationContext";
import { mergeData } from "../../lib/filterData";
import { exportReport } from "../../lib/exportReport";
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
  } = useReconciliation();

  const urlParams = new URLSearchParams(window.location.search);
  const insuranceName = urlParams.get("Insurance");
  const pathParts = window.location.pathname.split("/");
  const pageName = pathParts[pathParts.length - 1].split(".")[0]; // Gets "Reconciliation"
  console.log("Page name:", pageName);

  const isSubsite = pageName === "Reconciliation" ? true : false;

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
      insuranceName || ""
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
              src={require("../assets/frci_logo.png")}
              alt="logo"
              fluid
              style={{
                width: "10%",
                minWidth: "100px",
              }}
            />
          </a>
        </Col>
        <Col className="text-end">
          {isSubsite ? (
            <div className="d-flex gap-2 justify-content-end">
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
            </div>
          ) : (
            <div className="d-flex gap-2 justify-content-end">
              <Button
                appearance="primary"
                className={styles.actionButton}
                icon={<AddRegular />}
                onClick={() => {
                  window.open(
                    `${context.pageContext.web.absoluteUrl}/SitePages/Onboarding Insurance.aspx`,
                    "_blank"
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
            </div>
          )}
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
