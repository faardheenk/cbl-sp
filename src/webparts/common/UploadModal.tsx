import React, { useState } from "react";
import { Modal, Form, Button, Row, Col } from "react-bootstrap";
import styles from "./UploadModal.module.scss";
import { uploadExcelFiles } from "../../lib/uploadFiles";
import { useSpContext } from "../../SpContext";
import { useTasks } from "../../context/TaskContext";
import {
  Toast,
  ToastBody,
  Toaster,
  ToastTitle,
  useId,
  useToastController,
} from "@fluentui/react-components";

interface UploadModalProps {
  show: boolean;
  onClose: () => void;

  insuranceOptions: string[];
  file1Label?: string;
  file2Label?: string;
}

const UploadModal: React.FC<UploadModalProps> = ({
  show,
  onClose,

  insuranceOptions,
  file1Label = "CBL",
  file2Label,
}) => {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [selectedInsurance, setSelectedInsurance] = useState(
    insuranceOptions[0]
  );

  const { context, sp } = useSpContext();
  const { tasks, setTasks } = useTasks();
  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);

  const handleClose = () => {
    setFile1(null);
    setFile2(null);
    setSelectedInsurance(insuranceOptions[0]);
    onClose();
  };

  const handleUpload = async (
    file1: File | null,
    file2: File | null,
    selectedInsurance: string
  ) => {
    if (!file1 || !file2) return;

    try {
      // Create timestamp for folder name
      const now = new Date();
      const timestamp = now.toISOString().split("T")[0].replace(/-/g, "_");

      // Base folder path
      const baseFolderPath = `${
        context.pageContext.web.serverRelativeUrl
      }/Reconciliation Library/${selectedInsurance.toUpperCase()}`;

      // Create new folder with timestamp
      const newFolderPath = `${baseFolderPath}/${timestamp}`;
      await sp.web.folders.addUsingPath(newFolderPath);

      // Upload files to the new folder
      await uploadExcelFiles(sp, [file1, file2], newFolderPath, [
        file1.name,
        file2.name,
      ]);

      dispatchToast(
        <Toast className="bg-success text-white rounded-3">
          <ToastTitle>Saved Successfully</ToastTitle>
        </Toast>,
        { position: "top", intent: "success" }
      );

      setTasks((prev) => [
        ...prev,
        {
          date: timestamp,
          insurance: selectedInsurance,
          status: "Pending",
          url: `${context.pageContext.web.absoluteUrl}/SitePages/Reconciliation.aspx?Insurance=${selectedInsurance}`,
        },
      ]);

      handleClose();
    } catch (error) {
      console.error("Error uploading files:", error);
      dispatchToast(
        <Toast className="bg-danger text-white rounded-3">
          <ToastTitle>Error</ToastTitle>
          <ToastBody>Failed to upload files. Please try again.</ToastBody>
        </Toast>,
        { position: "top", intent: "error" }
      );
    }
  };

  return (
    <>
      <Toaster toasterId={toasterId} />
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
              onClick={() => handleUpload(file1, file2, selectedInsurance)}
              className={styles.uploadButton}
            >
              <i className="bi bi-cloud-arrow-up me-1" /> Upload
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default UploadModal;
