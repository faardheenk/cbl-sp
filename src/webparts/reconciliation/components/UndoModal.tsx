import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
} from "@fluentui/react-components";
import { Table, Tooltip } from "antd";
import { ColumnsType } from "antd/es/table";
import { ArrowUndoRegular, DismissRegular } from "@fluentui/react-icons";
import {
  useReconciliation,
  ActionHistoryItem,
} from "../../../context/ReconciliationContext";
import { formatAmount } from "../../../utils/utils";
import styles from "./Reconciliation.module.scss";

// Custom styles for the undo modal tables
const undoModalStyles = `
  /* Modal surface background */
  .undo-modal-surface {
    background-color: #f8fafc !important;
  }

  .undo-modal-table .ant-table {
    background-color: #ffffff !important;
    border-radius: 6px !important;
    overflow: hidden !important;
  }

  .undo-modal-table .ant-table-container {
    background-color: #ffffff !important;
  }

  .undo-modal-table .ant-table-tbody > tr > td {
    height: 36px !important;
    padding: 6px 8px !important;
    vertical-align: middle !important;
    line-height: 1.3 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    font-size: 11px !important;
    background-color: #ffffff !important;
  }
  
  .undo-modal-table .ant-table-thead > tr > th {
    height: 38px !important;
    padding: 6px 8px !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    background-color: #e2e8f0 !important;
    color: #475569 !important;
  }
  
  .undo-modal-table .ant-table-cell {
    max-width: 100px !important;
  }
  
  .undo-modal-table .ant-table-tbody > tr:hover > td {
    background-color: #f1f5f9 !important;
  }

  .undo-modal-table .ant-table-tbody > tr:nth-child(even) > td {
    background-color: #f9fafb !important;
  }

  .undo-modal-table .ant-table-tbody > tr:nth-child(even):hover > td {
    background-color: #f1f5f9 !important;
  }

  .undo-action-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
    transition: all 0.2s ease;
    background-color: #ffffff;
  }

  .undo-action-card:hover {
    border-color: #0078d4;
    box-shadow: 0 2px 8px rgba(0, 120, 212, 0.15);
  }

  .undo-action-card.selected {
    border-color: #0078d4;
    background-color: #f0f7ff;
  }

  .undo-action-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
    border-bottom: 1px solid #e2e8f0;
  }

  .undo-action-header-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .undo-action-title {
    font-weight: 600;
    font-size: 13px;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .undo-action-meta {
    font-size: 11px;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .undo-action-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .undo-action-badge.exact {
    background-color: #dcfce7;
    color: #166534;
  }

  .undo-action-badge.partial {
    background-color: #fef3c7;
    color: #92400e;
  }

  .undo-action-badge.no-match {
    background-color: #fee2e2;
    color: #991b1b;
  }

  .undo-action-body {
    padding: 12px 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    background-color: #f8fafc;
  }

  .undo-table-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .undo-table-header {
    font-weight: 600;
    font-size: 12px;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .undo-table-count {
    font-size: 11px;
    color: #0078d4;
    background-color: #e0f2fe;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .undo-summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background-color: #e2e8f0;
    border-radius: 4px;
    margin-top: 4px;
  }

  .undo-summary-label {
    font-size: 11px;
    color: #64748b;
  }

  .undo-summary-value {
    font-size: 12px;
    font-weight: 600;
    color: #1e293b;
  }
`;

// Inject styles
if (typeof document !== "undefined") {
  const existingStyle = document.getElementById("undo-modal-styles");
  if (!existingStyle) {
    const styleElement = document.createElement("style");
    styleElement.id = "undo-modal-styles";
    styleElement.textContent = undoModalStyles;
    document.head.appendChild(styleElement);
  }
}

type UndoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUndo: (actionIds: string[]) => void;
};

function UndoModal({ isOpen, onClose, onUndo }: UndoModalProps) {
  const { actionHistory } = useReconciliation();
  const [selectedActions, setSelectedActions] = useState<Set<string>>(
    new Set()
  );

  // Default columns for CBL
  const defaultCblColumns: ColumnsType = [
    {
      title: "Policy No",
      dataIndex: "PolicyNo",
      key: "PolicyNo",
      width: 100,
      ellipsis: true,
    },
    {
      title: "Placing No",
      dataIndex: "PlacingNo",
      key: "PlacingNo",
      width: 90,
      ellipsis: true,
    },
    {
      title: "Client Name",
      dataIndex: "ClientName",
      key: "ClientName",
      width: 120,
      ellipsis: true,
    },
    {
      title: "Amount",
      dataIndex: "ProcessedAmount",
      key: "ProcessedAmount",
      width: 90,
      ellipsis: true,
    },
  ];

  // Default columns for Insurer
  const defaultInsurerColumns: ColumnsType = [
    {
      title: "Policy No",
      dataIndex: "PolicyNo",
      key: "PolicyNo",
      width: 100,
      ellipsis: true,
    },
    {
      title: "Placing No",
      dataIndex: "PlacingNo",
      key: "PlacingNo",
      width: 90,
      ellipsis: true,
    },
    {
      title: "Client Name",
      dataIndex: "ClientName",
      key: "ClientName",
      width: 120,
      ellipsis: true,
    },
    {
      title: "Amount",
      dataIndex: "ProcessedAmount",
      key: "ProcessedAmount",
      width: 90,
      ellipsis: true,
    },
  ];

  // Get simplified columns for display - always use default columns to ensure consistent display
  const simplifiedCblColumns: ColumnsType = useMemo(() => {
    // Always use our predefined columns to ensure consistency
    return defaultCblColumns;
  }, []);

  const simplifiedInsurerColumns: ColumnsType = useMemo(() => {
    // Always use our predefined columns to ensure consistency
    return defaultInsurerColumns;
  }, []);

  const handleToggleAction = (actionId: string) => {
    const newSelected = new Set(selectedActions);
    if (newSelected.has(actionId)) {
      newSelected.delete(actionId);
    } else {
      newSelected.add(actionId);
    }
    setSelectedActions(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedActions.size === actionHistory.length) {
      setSelectedActions(new Set());
    } else {
      setSelectedActions(new Set(actionHistory.map((a) => a.id)));
    }
  };

  const handleUndo = () => {
    console.log("UndoModal handleUndo triggered");
    console.log("selectedActions:", Array.from(selectedActions));
    if (selectedActions.size > 0) {
      console.log("Calling onUndo with:", Array.from(selectedActions));
      onUndo(Array.from(selectedActions));
      setSelectedActions(new Set());
      onClose();
    }
  };

  const getActionTypeLabel = (
    actionType: ActionHistoryItem["actionType"]
  ): string => {
    switch (actionType) {
      case "moveToExact":
        return "Moved to Exact Match";
      case "moveToPartial":
        return "Moved to Partial Match";
      case "unmatch":
        return "Unmatched";
      default:
        return actionType;
    }
  };

  const getSectionBadgeClass = (section: string): string => {
    switch (section) {
      case "exact":
        return "exact";
      case "partial":
        return "partial";
      case "no-match":
        return "no-match";
      default:
        return "";
    }
  };

  const formatTimestamp = (date: Date): string => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const calculateTotal = (rows: any[]): number => {
    return rows.reduce((sum, row) => {
      const amount = parseFloat(row.ProcessedAmount) || 0;
      return sum + amount;
    }, 0);
  };

  // Sort history by timestamp (newest first)
  const sortedHistory = useMemo(() => {
    return [...actionHistory].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [actionHistory]);

  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface
        className="undo-modal-surface"
        style={{
          maxWidth: "1100px",
          width: "95vw",
          backgroundColor: "#f8fafc",
        }}
      >
        <DialogBody style={{ backgroundColor: "#f8fafc" }}>
          <DialogTitle
            style={{
              backgroundColor: "#ffffff",
              borderBottom: "1px solid #e2e8f0",
              padding: "16px 24px",
            }}
            action={
              <Button
                appearance="subtle"
                aria-label="Close"
                icon={<DismissRegular />}
                onClick={onClose}
              />
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ArrowUndoRegular fontSize={20} />
              <span>Undo Actions</span>
              {actionHistory.length > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    fontWeight: "normal",
                  }}
                >
                  ({actionHistory.length} action
                  {actionHistory.length !== 1 ? "s" : ""} available)
                </span>
              )}
            </div>
          </DialogTitle>

          <DialogContent
            style={{
              padding: "16px",
              maxHeight: "60vh",
              overflowY: "auto",
              backgroundColor: "#f1f5f9",
            }}
          >
            {actionHistory.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#64748b",
                  backgroundColor: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <ArrowUndoRegular
                  style={{
                    fontSize: "48px",
                    marginBottom: "16px",
                    opacity: 0.5,
                  }}
                />
                <p style={{ fontSize: "14px", margin: 0 }}>
                  No actions to undo. Make some changes first.
                </p>
              </div>
            ) : (
              <>
                {/* Select All Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                    padding: "12px 16px",
                    backgroundColor: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Checkbox
                      checked={
                        selectedActions.size === actionHistory.length
                          ? true
                          : selectedActions.size > 0
                          ? "mixed"
                          : false
                      }
                      onChange={handleSelectAll}
                      style={{ marginTop: "0" }}
                    />
                    <span style={{ fontWeight: 600, fontSize: "13px", lineHeight: "1" }}>
                      Select All Actions ({selectedActions.size} of{" "}
                      {actionHistory.length} selected)
                    </span>
                  </div>
                  {selectedActions.size > 0 && (
                    <Tooltip title="Total amount in selected rows">
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#0078d4",
                          fontWeight: 600,
                        }}
                      >
                        {selectedActions.size} action
                        {selectedActions.size !== 1 ? "s" : ""} will be undone
                      </span>
                    </Tooltip>
                  )}
                </div>

                {/* Action Cards */}
                {sortedHistory.map((action) => (
                  <div
                    key={action.id}
                    className={`undo-action-card ${
                      selectedActions.has(action.id) ? "selected" : ""
                    }`}
                  >
                    <div className="undo-action-header">
                      <Checkbox
                        checked={selectedActions.has(action.id)}
                        onChange={() => handleToggleAction(action.id)}
                      />
                      <div className="undo-action-header-content">
                        <div className="undo-action-title">
                          {getActionTypeLabel(action.actionType)}
                          <span
                            className={`undo-action-badge ${getSectionBadgeClass(
                              action.fromSection
                            )}`}
                          >
                            {action.fromSection}
                          </span>
                          <span style={{ color: "#94a3b8" }}>→</span>
                          <span
                            className={`undo-action-badge ${getSectionBadgeClass(
                              action.toSection
                            )}`}
                          >
                            {action.toSection}
                          </span>
                        </div>
                        <div className="undo-action-meta">
                          <span>{formatTimestamp(action.timestamp)}</span>
                          <span>•</span>
                          <span>
                            {action.cblRows.length} CBL row
                            {action.cblRows.length !== 1 ? "s" : ""}
                          </span>
                          <span>•</span>
                          <span>
                            {action.insurerRows.length} Insurer row
                            {action.insurerRows.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="undo-action-body">
                      {/* CBL Table */}
                      <div className="undo-table-section">
                        <div className="undo-table-header">
                          <span>CBL Rows</span>
                          <span className="undo-table-count">
                            {action.cblRows.length} items
                          </span>
                        </div>
                        <Table
                          columns={simplifiedCblColumns}
                          dataSource={action.cblRows}
                          rowKey="idx"
                          size="small"
                          pagination={false}
                          scroll={{ x: 400, y: 150 }}
                          className="undo-modal-table"
                        />
                        <div className="undo-summary-row">
                          <span className="undo-summary-label">
                            Total Amount
                          </span>
                          <span className="undo-summary-value">
                            Rs {formatAmount(calculateTotal(action.cblRows))}
                          </span>
                        </div>
                      </div>

                      {/* Insurer Table */}
                      <div className="undo-table-section">
                        <div className="undo-table-header">
                          <span>Insurer Rows</span>
                          <span className="undo-table-count">
                            {action.insurerRows.length} items
                          </span>
                        </div>
                        <Table
                          columns={simplifiedInsurerColumns}
                          dataSource={action.insurerRows}
                          rowKey="idx"
                          size="small"
                          pagination={false}
                          scroll={{ x: 400, y: 150 }}
                          className="undo-modal-table"
                        />
                        <div className="undo-summary-row">
                          <span className="undo-summary-label">
                            Total Amount
                          </span>
                          <span className="undo-summary-value">
                            Rs{" "}
                            {formatAmount(calculateTotal(action.insurerRows))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </DialogContent>

          <DialogActions
            style={{
              backgroundColor: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              padding: "16px 24px",
              gap: "12px",
            }}
          >
            <Button
              appearance="secondary"
              onClick={onClose}
              style={{
                backgroundColor: "#f1f5f9",
                border: "1px solid #cbd5e1",
                color: "#475569",
                fontWeight: 600,
                padding: "8px 20px",
                minWidth: "100px",
              }}
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              icon={<ArrowUndoRegular />}
              disabled={selectedActions.size === 0}
              onClick={handleUndo}
              style={{
                backgroundColor: selectedActions.size === 0 ? "#94a3b8" : "#0078d4",
                border: "none",
                color: "#ffffff",
                fontWeight: 600,
                padding: "8px 20px",
                minWidth: "160px",
                boxShadow: selectedActions.size === 0 ? "none" : "0 2px 4px rgba(0, 120, 212, 0.3)",
              }}
            >
              Undo Selected ({selectedActions.size})
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export default UndoModal;
