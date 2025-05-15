import React, { useState } from "react";
import { Row, Col, Button, Image } from "react-bootstrap";
import styles from "./Header.module.scss";
import UploadModal from "./UploadModal";
import { useSpContext } from "../../SpContext";
import { uploadExcelFiles } from "../../lib/uploadFiles";

const Header: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const { context, sp } = useSpContext();

  const insuranceOptions = ["Swan", "MUA", "Sicom", "Eagle Insurance"];

  const handleOpen = () => {
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
  };

  return (
    <>
      <Row className="align-items-center mb-4">
        <Col>
          <a href={context.pageContext.web.absoluteUrl}>
            <Image
              src={require("../assets/city-broker.png")}
              alt="logo"
              fluid
              style={{
                width: "20%",
              }}
            />
          </a>
        </Col>
        <Col className="text-end">
          <Button onClick={handleOpen} className={styles.actionButton}>
            <i className="bi bi-cloud-arrow-up me-2" />
            Upload Statements
          </Button>
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
