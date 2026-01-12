import React, { useEffect, useState } from "react";
import { Modal, Form, Row, Col, Button, Spinner } from "react-bootstrap";
import styles from "./UploadModal.module.scss";
import { uploadExcelFiles } from "../../lib/uploadFiles";
import { useSpContext } from "../../SpContext";
import { useTasks } from "../../context/TaskContext";
import RobotLoader from "./RobotLoaders";
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
  // insuranceOptions: string[];
  file1Label?: string;
  file2Label?: string;
}

const UploadModal: React.FC<UploadModalProps> = ({
  show,
  onClose,
  file1Label = "CBL", // to change to CBL
  file2Label,
}) => {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  const [showLoader, setShowLoader] = useState(false);

  const { context, sp } = useSpContext();
  const { tasks, setTasks } = useTasks();
  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);
  const [insuranceNames, setInsuranceNames] = useState<string[]>([]);
  const [selectedInsurance, setSelectedInsurance] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchInsuranceNames = async () => {
    const data = await sp.web.lists
      .getByTitle("Mappings")
      .items.select("Title")
      .filter("Title ne 'CBL'")();

    const insuranceNames = data.map(({ Title }: { Title: string }) => Title);

    setInsuranceNames(insuranceNames);
    setSelectedInsurance(insuranceNames[0]);
  };

  useEffect(() => {
    fetchInsuranceNames();
  }, []);

  const handleClose = () => {
    setFile1(null);
    setFile2(null);
    setSelectedInsurance("");
    setShowLoader(false);
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
      const formattedDate = now.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      console.log("Selected insurance:", selectedInsurance);

      // Base folder path
      const baseFolderPath = `${
        context.pageContext.web.serverRelativeUrl
      }/Reconciliation Library/${selectedInsurance.toUpperCase()}`;

      // Create new folder with timestamp
      const newFolderPath = `${baseFolderPath}/${formattedDate}`;
      await sp.web.folders.addUsingPath(newFolderPath);

      // Get folder item to get ID
      const folderItem = await sp.web.getFolderByServerRelativePath(
        newFolderPath
      );
      const items = await folderItem.getItem();
      const { Id: folderId } = await items();

      // Create new folder name with ID
      const newFolderName = `${formattedDate}_${folderId}`;
      const updatedFolderPath = `${baseFolderPath}/${newFolderName}`;

      // Rename folder
      await sp.web
        .getFolderByServerRelativePath(newFolderPath)
        .getItem()
        .then((item) => item.update({ FileLeafRef: newFolderName }));

      // Set folder status
      await items.update({
        Status: "Pending",
      });

      // Upload excel files to renamed folder
      await uploadExcelFiles(sp, [file1, file2], updatedFolderPath, [
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
          date: formattedDate,
          insurance: selectedInsurance,
          status: "Pending",
          url: `${context.pageContext.web.absoluteUrl}/SitePages/Reconciliation.aspx?Insurance=${selectedInsurance}`,
          createdDate: new Date(), // Use current date for newly created tasks
        },
      ]);

      // handleClose();
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
      <Modal
        show={show}
        onHide={handleClose}
        centered
        backdrop="static"
        size="lg"
      >
        <Modal.Header closeButton className={styles.modalHeader}>
          <Modal.Title>
            <i className="bi bi-upload me-2" />
            Upload Statements
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.modalBody}>
          {/* {showLoader ? (
              <div
                className="d-flex justify-content-center align-items-center"
                style={{ height: "500px", width: "100%" }}
              >
                <div style={{ width: "100%", maxWidth: "500px" }}>
                  <RobotLoader />
                </div>
              </div>
            ) : ( */}
          <>
            <Form.Group controlId="formInsurance" className="mb-3">
              <Form.Label className={styles.formLabel}>
                <i className="bi bi-building me-1" /> Insurance Name
              </Form.Label>
              <Form.Select
                value={selectedInsurance}
                onChange={(e) => setSelectedInsurance(e.target.value)}
              >
                {insuranceNames.map((option) => (
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
                      setFile1(
                        (e.target as HTMLInputElement).files?.[0] || null
                      )
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
                      setFile2(
                        (e.target as HTMLInputElement).files?.[0] || null
                      )
                    }
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <div className="d-flex justify-content-end gap-2">
              <Button
                size="sm"
                onClick={handleClose}
                className="p-2"
                variant="outline-primary"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="p-2 d-flex align-items-center"
                disabled={!file1 || !file2 || isLoading}
                onClick={async () => {
                  setIsLoading(true);
                  setShowLoader(true);
                  await handleUpload(file1, file2, selectedInsurance);
                  handleClose();
                  setIsLoading(false);
                }}
              >
                {isLoading && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      height: "1rem",
                    }}
                  >
                    <Spinner size="sm" className="me-2" />
                  </span>
                )}
                Upload
              </Button>
            </div>
          </>
          {/* )} */}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default UploadModal;
