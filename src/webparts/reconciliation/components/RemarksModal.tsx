import React, { useState, useEffect } from "react";
import { Modal, Button } from "react-bootstrap";

type RemarksModalProps = {
  show: boolean;
  onClose: () => void;
  onSubmit: (remarks: string) => void;
  onSkip?: () => void;
  initialRemarks?: string;
  title?: string;
  showSkipButton?: boolean;
};

function RemarksModal({
  show,
  onClose,
  onSubmit,
  onSkip,
  initialRemarks = "",
  title = "Add Remarks",
  showSkipButton = false,
}: RemarksModalProps) {
  const [remarks, setRemarks] = useState(initialRemarks);

  useEffect(() => {
    if (show) {
      setRemarks(initialRemarks);
    }
  }, [show, initialRemarks]);

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: "0.9rem", fontWeight: 600 }}>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <div>
            <label
              htmlFor="remarks-input"
              style={{
                fontWeight: 500,
                fontSize: "0.8rem",
                marginBottom: "0.25rem",
                display: "block",
              }}
            >
              Remarks
            </label>
            <textarea
              id="remarks-input"
              rows={4}
              placeholder="Enter remarks (optional)..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: "0.8rem",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                outline: "none",
                resize: "vertical",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#0078d4")}
              onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        {onSkip ? (
          <Button variant="outline-secondary" size="sm" onClick={onSkip}>
            Skip
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSubmit(remarks)}
          disabled={!remarks.trim()}
        >
          Add Remarks
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default RemarksModal;
