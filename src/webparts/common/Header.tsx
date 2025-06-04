import React, { useState } from "react";
import { Row, Col, Image } from "react-bootstrap";
import { Button } from "@fluentui/react-components";
import {
  ArrowUploadRegular,
  ArrowDownloadRegular,
  HomeRegular,
} from "@fluentui/react-icons";
import styles from "./Header.module.scss";
import UploadModal from "./UploadModal";
import { useSpContext } from "../../SpContext";
import { uploadExcelFiles } from "../../lib/uploadFiles";

const Header: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const { context, sp } = useSpContext();

  const urlParams = new URLSearchParams(window.location.search);
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
                width: "15%",
                minWidth: "120px",
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
            <Button
              onClick={handleOpen}
              appearance="primary"
              className={styles.actionButton}
              icon={<ArrowUploadRegular />}
            >
              Upload Statements
            </Button>
          )}
        </Col>
      </Row>

      <UploadModal
        show={showModal}
        onClose={handleClose}
        insuranceOptions={insuranceOptions}
      />
    </>
  );
};

export default Header;
