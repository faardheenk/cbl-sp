import React, { useState } from "react";
import { Modal, Form, Button, Row, Col } from "react-bootstrap";
import styles from "./UploadModal.module.scss";

interface UploadModalProps {
  show: boolean;
  onClose: () => void;
  onUpload: (
    file1: File | null,
    file2: File | null,
    selectedInsurance: string
  ) => void;
  insuranceOptions: string[];
  file1Label?: string;
  file2Label?: string;
}

const UploadModal: React.FC<UploadModalProps> = ({
  show,
  onClose,
  onUpload,
  insuranceOptions,
  file1Label = "CBL",
  file2Label,
}) => {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [selectedInsurance, setSelectedInsurance] = useState(
    insuranceOptions[0]
  );

  const handleClose = () => {
    setFile1(null);
    setFile2(null);
    setSelectedInsurance(insuranceOptions[0]);
    onClose();
  };

  const handleUpload = () => {
    // onUpload(file1, file2, selectedInsurance);
    alert("This functionality is not available yet");
    handleClose();
  };

  return (
    <Modal show={show} onHide={handleClose} centered backdrop="static">
      <Modal.Header closeButton className={styles.modalHeader}>
        <Modal.Title>
          <i className="bi bi-upload me-2" />
          Upload Statements
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.modalBody}>
        <Form.Group controlId="formInsurance" className="mb-3">
          <Form.Label className={styles.formLabel}>
            <i className="bi bi-building me-1" /> Insurance Name
          </Form.Label>
          <Form.Select
            value={selectedInsurance}
            onChange={(e) => setSelectedInsurance(e.target.value)}
          >
            {insuranceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Row>
          <Col md={6} className="mb-3">
            <Form.Group controlId="formFile1">
              <Form.Label className={styles.formLabel}>
                <i className="bi bi-file-earmark me-1" /> {file1Label}
              </Form.Label>
              <Form.Control
                type="file"
                accept=".xls,.xlsx"
                onChange={(e) =>
                  setFile1((e.target as HTMLInputElement).files?.[0] || null)
                }
                required
              />
            </Form.Group>
          </Col>
          <Col md={6} className="mb-3">
            <Form.Group controlId="formFile2">
              <Form.Label className={styles.formLabel}>
                <i className="bi bi-file-earmark me-1" />{" "}
                {file2Label || selectedInsurance}
              </Form.Label>
              <Form.Control
                type="file"
                accept=".xls,.xlsx"
                onChange={(e) =>
                  setFile2((e.target as HTMLInputElement).files?.[0] || null)
                }
                required
              />
            </Form.Group>
          </Col>
        </Row>
        <div className="d-flex justify-content-end">
          <Button
            variant="light"
            onClick={handleClose}
            className={styles.cancelButton}
          >
            <i className="bi bi-x-circle me-1" /> Cancel
          </Button>
          <Button
            type="button"
            disabled={!file1 || !file2}
            onClick={handleUpload}
            className={styles.uploadButton}
          >
            <i className="bi bi-cloud-arrow-up me-1" /> Upload
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default UploadModal;
