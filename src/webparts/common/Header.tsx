import React, { useState } from "react";
import { Row, Col, Button, Image } from "react-bootstrap";
import styles from "./Header.module.scss";
import UploadModal from "./UploadModal";
import { useSpContext } from "../../SpContext";

interface HeaderProps {
  title: string;
  actionButton?: {
    label: string;
    onClick?: () => void;
    icon?: string;
    showUploadModal?: boolean;
    onUpload?: (
      file1: File | null,
      file2: File | null,
      selectedInsurance: string
    ) => void;
    insuranceOptions?: string[];
    file1Label?: string;
    file2Label?: string;
  };
}
const Header: React.FC<HeaderProps> = ({ title, actionButton }) => {
  const [showModal, setShowModal] = useState(false);
  const { context } = useSpContext();

  const handleOpen = () => {
    if (actionButton?.showUploadModal) {
      setShowModal(true);
    } else {
      actionButton?.onClick?.();
    }
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
        {actionButton && (
          <Col className="text-end">
            <Button onClick={handleOpen} className={styles.actionButton}>
              {actionButton.icon && (
                <i className={`bi ${actionButton.icon} me-2`} />
              )}
              {actionButton.label}
            </Button>
          </Col>
        )}
      </Row>

      {actionButton?.showUploadModal && (
        <UploadModal
          show={showModal}
          onClose={handleClose}
          onUpload={actionButton.onUpload!}
          insuranceOptions={actionButton.insuranceOptions || []}
          file1Label={actionButton.file1Label}
          file2Label={actionButton.file2Label}
        />
      )}
    </>
  );
};

export default Header;
