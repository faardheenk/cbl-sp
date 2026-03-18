import React, { useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import styles from "./Landing.module.scss";
import { Container, Card, Badge, Breadcrumb, Modal } from "react-bootstrap";
import {
  FolderRegular,
  OpenRegular,
  DeleteRegular,
} from "@fluentui/react-icons";
import {
  Button,
  Spinner,
  Toast,
  ToastBody,
  ToastTitle,
  Toaster,
  useId,
  useToastController,
} from "@fluentui/react-components";

import Header from "../../common/Header";
import { useTasks, Task } from "../../../context/TaskContext";
import { useSpContext } from "../../../SpContext";
import { IFolderInfo } from "@pnp/sp/folders";

import { Table, TableProps } from "antd";
import {
  MatchHistoryEntry,
  overwriteMatchHistory,
  readMatchHistory,
} from "../../../utils/matchHistory";
import { BucketKey } from "../../../utils/reconciliationBuckets";

const COLORS = {
  primary: "#5A6374", // muted slate gray
  secondary: "#8D8D92", // soft gray
  lightBg: "#F9FAFB", // very light gray
  headerText: "#2C2E33", // dark charcoal
  tableHeaderBg: "#E5E7EB", // light gray
};

interface BreadcrumbItem {
  name: string;
  path: string;
  serverRelativeUrl: string;
}

type MatrixHistoryEntry = MatchHistoryEntry & {
  id: string;
};

const Landing = () => {
  console.log("styles >> ", styles);

  const { context, sp } = useSpContext();
  const { tasks, setTasks } = useTasks();
  const [isLoading, setIsLoading] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);
  const [isDeletingMatrixEntry, setIsDeletingMatrixEntry] = useState(false);
  const [matrixEntries, setMatrixEntries] = useState<MatrixHistoryEntry[]>([]);
  const [matrixError, setMatrixError] = useState<string | null>(null);
  const [entryPendingDelete, setEntryPendingDelete] =
    useState<MatrixHistoryEntry | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { name: "Reconciliation Library", path: "", serverRelativeUrl: "" },
  ]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const toasterId = useId("landing-toaster");
  const { dispatchToast } = useToastController(toasterId);

  const currentInsuranceName = useMemo(
    () => (currentPath ? currentPath.split("/")[0] : ""),
    [currentPath],
  );

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("_");
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const columns: TableProps<any>["columns"] = [
    // Only show Insurance column at root level
    ...(!currentPath
      ? [
          {
            title: "Insurance",
            dataIndex: "insurance",
            key: "insurance",
            render: (text: string, record: any) => {
              if (record.isFolder) {
                return (
                  <span
                    style={{
                      color: "#0078d4",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                    onClick={() => handleFolderClick(record)}
                  >
                    <FolderRegular style={{ fontSize: "18px" }} />
                    {text}
                  </span>
                );
              }
              return text;
            },
          },
        ]
      : []),
    // Only show Date, Status, and Action columns when inside an insurance folder
    ...(currentPath
      ? [
          {
            title: "Date",
            dataIndex: "date",
            key: "date",
            render: (text: string, record: any) => {
              if (record.isFolder) return null;
              return text;
            },
          },
          {
            title: "Status",
            dataIndex: "status",
            render: (_text: string, row: any) => {
              if (row.isFolder) return null;
              return (
                <Badge
                  bg={badgeVariant(row.status)}
                  style={{ padding: "0.5rem" }}
                >
                  {row.status}
                </Badge>
              );
            },
            key: "status",
          },
          {
            title: "Action",
            dataIndex: "url",
            render: (_text: string, row: any) => {
              if (row.isFolder) return null;
              return (
                <Button
                  as="a"
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  appearance="secondary"
                  size="medium"
                  icon={<OpenRegular style={{ fontSize: "16px" }} />}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              );
            },
            key: "action",
          },
        ]
      : []),
  ];

  const fetchFolders = async (path: string = "") => {
    // Guard clause to ensure sp is available
    if (!sp) {
      console.log("SharePoint context not ready in Landing component");
      return;
    }

    try {
      setIsLoading(true);
      // Get the document library
      const docLib = await sp.web.lists.getByTitle("Reconciliation Library");

      let folders: IFolderInfo[];

      if (!path) {
        // Root level: Get all insurance folders
        folders = await docLib.rootFolder.folders();
      } else {
        // Navigated into a folder: Get subfolders
        const fullPath = path.startsWith("/")
          ? path
          : `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/${path}`;
        const folder = sp.web.getFolderByServerRelativePath(fullPath);
        folders = await folder.folders();
      }

      console.log("FOLDERS >>> ", folders);

      // Transform folders into display format
      const folderItems = await Promise.all(
        folders
          .filter(
            (folder: IFolderInfo) =>
              folder.Name !== "Document" && folder.Name !== "Forms"
          )
          .map(async (folder: IFolderInfo) => {
            // Check if this folder has subfolders (reconciliation processes)
            try {
              const subFolders = await sp.web
                .getFolderByServerRelativePath(folder.ServerRelativeUrl)
                .folders();

              const hasSubFolders = subFolders.some(
                (sf: IFolderInfo) =>
                  sf.Name !== "Document" && sf.Name !== "Forms"
              );

              // If we're at root level, show insurance folders
              if (!path) {
                return {
                  name: folder.Name,
                  insurance: folder.Name,
                  isFolder: true,
                  serverRelativeUrl: folder.ServerRelativeUrl,
                  path: folder.Name,
                  hasSubFolders,
                };
              } else {
                // We're inside an insurance folder, show reconciliation process folders
                // Extract insurance name from path (first part before any slashes)
                const insuranceName = path.split("/")[0];

                // Get folder properties to access status
                try {
                  const folderProps = await sp.web
                    .getFolderByServerRelativePath(folder.ServerRelativeUrl)
                    .listItemAllFields();
                  const status = folderProps.Status || "Pending";

                  const folderNameParts = folder.Name.split("_");
                  const datePart = folderNameParts[0];

                  return {
                    name: folder.Name,
                    date: datePart,
                    insurance: insuranceName,
                    status: status as
                      | "Pending"
                      | "In Progress"
                      | "Manual Review"
                      | "Completed"
                      | "Failed",
                    url: `${context.pageContext.web.absoluteUrl}/SitePages/Reconciliation.aspx?Insurance=${insuranceName}&Date=${folder.Name}`,
                    createdDate: new Date(folder.TimeCreated),
                    isFolder: hasSubFolders,
                    serverRelativeUrl: folder.ServerRelativeUrl,
                    path: path ? `${path}/${folder.Name}` : folder.Name,
                    hasSubFolders,
                  };
                } catch (error) {
                  console.error("Error getting folder properties:", error);
                  return {
                    name: folder.Name,
                    date: folder.Name.split("_")[0],
                    insurance: insuranceName,
                    status: "Pending" as const,
                    url: `${context.pageContext.web.absoluteUrl}/SitePages/Reconciliation.aspx?Insurance=${insuranceName}&Date=${folder.Name}`,
                    createdDate: new Date(folder.TimeCreated),
                    isFolder: hasSubFolders,
                    serverRelativeUrl: folder.ServerRelativeUrl,
                    path: path ? `${path}/${folder.Name}` : folder.Name,
                    hasSubFolders,
                  };
                }
              }
            } catch (error) {
              console.error("Error checking subfolders:", error);
              const insuranceName = !path ? folder.Name : path.split("/")[0];
              return {
                name: folder.Name,
                insurance: insuranceName,
                isFolder: false,
                serverRelativeUrl: folder.ServerRelativeUrl,
                path: path ? `${path}/${folder.Name}` : folder.Name,
                hasSubFolders: false,
              };
            }
          })
      );

      // Sort by creation date if available, otherwise by name
      folderItems.sort((a, b) => {
        if (a.createdDate && b.createdDate) {
          return b.createdDate.getTime() - a.createdDate.getTime();
        }
        return (a.name || "").localeCompare(b.name || "");
      });

      setTasks(folderItems);
    } catch (error) {
      console.error("Error fetching from Reconciliation Library:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderClick = (record: any) => {
    if (!record.isFolder) return;

    // Update breadcrumbs
    const newBreadcrumb: BreadcrumbItem = {
      name: record.name,
      path: record.path,
      serverRelativeUrl: record.serverRelativeUrl,
    };
    setBreadcrumbs([...breadcrumbs, newBreadcrumb]);
    setCurrentPath(record.path);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === breadcrumbs.length - 1) return; // Already at this level

    // Update breadcrumbs to selected level
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);

    // Update current path
    if (index === 0) {
      setCurrentPath("");
    } else {
      setCurrentPath(newBreadcrumbs[index].path);
    }
  };

  useEffect(() => {
    // Only fetch folders if sp context is available
    if (sp) {
      fetchFolders(currentPath).catch((error) => {
        console.error("Failed to fetch folders:", error);
      });
    } else {
      console.log("Waiting for SharePoint context to be ready...");
    }
  }, [sp, currentPath]);

  const badgeVariant = (status: string) => {
    if (status === "Completed") return "success";
    if (status === "Manual Review") return "primary";
    if (status === "In Progress") return "warning";
    return "secondary";
  };

  const formatBucketLabel = (bucketKey: BucketKey): string => {
    switch (bucketKey) {
      case "exact":
        return "Exact Matches";
      case "partial":
        return "Partial Matches";
      case "no-match":
        return "No Matches";
      default:
        return bucketKey;
    }
  };

  const parseFingerprint = (fingerprint: string): string[] =>
    String(fingerprint || "")
      .split("|")
      .map((part) => part.trim())
      .filter((part) => part !== "");

  const loadMatrixHistory = async () => {
    if (!sp || !currentInsuranceName) {
      return;
    }

    try {
      setIsMatrixLoading(true);
      setMatrixError(null);
      const entries = await readMatchHistory(
        sp,
        currentInsuranceName.toUpperCase().trim(),
        context.pageContext.web.serverRelativeUrl,
      );

      setMatrixEntries(
        entries.map((entry, index) => ({
          ...entry,
          id: `${entry.timestamp}-${entry.fromBucket}-${entry.targetBucket}-${index}`,
        })),
      );
      setIsMatrixModalOpen(true);
    } catch (error) {
      console.error("Failed to load matrix history:", error);
      setMatrixError("Failed to load matrix history.");
      setIsMatrixModalOpen(true);
    } finally {
      setIsMatrixLoading(false);
    }
  };

  const handleRequestDeleteMatrixEntry = (entry: MatrixHistoryEntry) => {
    setEntryPendingDelete(entry);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDeleteMatrixEntry = async () => {
    if (!sp || !currentInsuranceName || !entryPendingDelete) {
      return;
    }

    try {
      setIsDeletingMatrixEntry(true);
      const updatedEntries = matrixEntries
        .filter((entry) => entry.id !== entryPendingDelete.id)
        .map(({ id: _id, ...entry }) => entry);

      await overwriteMatchHistory(
        sp,
        updatedEntries,
        currentInsuranceName.toUpperCase().trim(),
        context.pageContext.web.serverRelativeUrl,
      );

      setMatrixEntries((prev) =>
        prev.filter((entry) => entry.id !== entryPendingDelete.id),
      );
      setIsConfirmDeleteOpen(false);
      setEntryPendingDelete(null);

      dispatchToast(
        <Toast>
          <ToastTitle>Matrix entry deleted</ToastTitle>
          <ToastBody>`history.xlsx` was updated successfully.</ToastBody>
        </Toast>,
        { position: "top", intent: "success" },
      );
    } catch (error) {
      console.error("Failed to delete matrix entry:", error);
      dispatchToast(
        <Toast>
          <ToastTitle>Delete failed</ToastTitle>
          <ToastBody>Could not update `history.xlsx`.</ToastBody>
        </Toast>,
        { position: "top", intent: "error" },
      );
    } finally {
      setIsDeletingMatrixEntry(false);
    }
  };

  return (
    <Container
      fluid
      style={{
        backgroundColor: COLORS.lightBg,
        minHeight: "100vh",
      }}
    >
      <Toaster toasterId={toasterId} />
      <Header />

      {/* Breadcrumb Navigation */}
      <Card
        style={{
          border: "none",
          borderRadius: "1rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          marginBottom: "1rem",
          padding: "1rem",
        }}
      >
        <style>
          {`
            .breadcrumb-item:not(.active) a {
              text-decoration: none !important;
            }
            .breadcrumb-item:not(.active) a:hover {
              text-decoration: underline !important;
            }
            .breadcrumb-item.active {
              text-decoration: none !important;
            }
          `}
        </style>
        <Breadcrumb>
          {breadcrumbs.map((crumb, index) => (
            <Breadcrumb.Item
              key={index}
              active={index === breadcrumbs.length - 1}
              onClick={() => handleBreadcrumbClick(index)}
              style={{
                cursor: index === breadcrumbs.length - 1 ? "default" : "pointer",
                color:
                  index === breadcrumbs.length - 1
                    ? "#6c757d"
                    : "#0078d4",
                textDecoration: "none",
              }}
            >
              {crumb.name}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
        {currentInsuranceName && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "1rem",
            }}
          >
            <Button
              appearance="primary"
              onClick={loadMatrixHistory}
              disabled={isMatrixLoading}
            >
              {isMatrixLoading ? <Spinner size="tiny" /> : "View Matrix"}
            </Button>
          </div>
        )}
      </Card>

      {/* Data Table */}
      <Card
        style={{
          border: "none",
          borderRadius: "1rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          marginBottom: "2rem",
        }}
      >
        <div style={{ overflowX: "auto", padding: "1rem" }}>
          <Table
            columns={columns}
            dataSource={tasks}
            size="small"
            loading={isLoading}
            rowKey={(record) =>
              record.serverRelativeUrl || record.url || record.name
            }
          />
        </div>
      </Card>

      <Modal
        show={isMatrixModalOpen}
        onHide={() => setIsMatrixModalOpen(false)}
        size="xl"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Matrix History{currentInsuranceName ? ` - ${currentInsuranceName}` : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "75vh", overflowY: "auto" }}>
          {matrixError ? (
            <div>{matrixError}</div>
          ) : matrixEntries.length === 0 ? (
            <div>No history entries found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {matrixEntries.map((entry) => (
                <Card key={entry.id} style={{ borderRadius: "0.75rem" }}>
                  <Card.Body>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "1rem",
                        marginBottom: "1rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {formatBucketLabel(entry.fromBucket)} to{" "}
                          {formatBucketLabel(entry.targetBucket)}
                        </div>
                        <div style={{ color: "#6c757d", fontSize: "0.9rem" }}>
                          {new Date(entry.timestamp).toLocaleString("en-GB")}
                        </div>
                      </div>
                      <Button
                        appearance="secondary"
                        icon={<DeleteRegular />}
                        onClick={() => handleRequestDeleteMatrixEntry(entry)}
                      >
                        Delete Entry
                      </Button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                          CBL Fingerprints
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          {entry.cblFingerprints.length === 0 ? (
                            <div style={{ color: "#6c757d" }}>No CBL fingerprints.</div>
                          ) : (
                            entry.cblFingerprints.map((fingerprint, index) => (
                              <div
                                key={`cbl-${entry.id}-${index}`}
                                style={{
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "0.5rem",
                                  padding: "0.75rem",
                                  backgroundColor: "#f8fafc",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.85rem",
                                    fontWeight: 600,
                                    marginBottom: "0.5rem",
                                  }}
                                >
                                  Fingerprint {index + 1}
                                </div>
                                <code
                                  style={{
                                    display: "block",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    marginBottom: "0.5rem",
                                  }}
                                >
                                  {fingerprint}
                                </code>
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "0.4rem",
                                  }}
                                >
                                  {parseFingerprint(fingerprint).map((part, partIndex) => (
                                    <span
                                      key={`cbl-part-${entry.id}-${index}-${partIndex}`}
                                      style={{
                                        backgroundColor: "#e2e8f0",
                                        borderRadius: "999px",
                                        padding: "0.2rem 0.55rem",
                                        fontSize: "0.8rem",
                                      }}
                                    >
                                      {part}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                          Insurer Fingerprints
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          {entry.insurerFingerprints.length === 0 ? (
                            <div style={{ color: "#6c757d" }}>
                              No insurer fingerprints.
                            </div>
                          ) : (
                            entry.insurerFingerprints.map((fingerprint, index) => (
                              <div
                                key={`insurer-${entry.id}-${index}`}
                                style={{
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "0.5rem",
                                  padding: "0.75rem",
                                  backgroundColor: "#f8fafc",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.85rem",
                                    fontWeight: 600,
                                    marginBottom: "0.5rem",
                                  }}
                                >
                                  Fingerprint {index + 1}
                                </div>
                                <code
                                  style={{
                                    display: "block",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    marginBottom: "0.5rem",
                                  }}
                                >
                                  {fingerprint}
                                </code>
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "0.4rem",
                                  }}
                                >
                                  {parseFingerprint(fingerprint).map((part, partIndex) => (
                                    <span
                                      key={`insurer-part-${entry.id}-${index}-${partIndex}`}
                                      style={{
                                        backgroundColor: "#e2e8f0",
                                        borderRadius: "999px",
                                        padding: "0.2rem 0.55rem",
                                        fontSize: "0.8rem",
                                      }}
                                    >
                                      {part}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>

      <Modal
        show={isConfirmDeleteOpen}
        onHide={() => !isDeletingMatrixEntry && setIsConfirmDeleteOpen(false)}
        centered
      >
        <Modal.Header closeButton={!isDeletingMatrixEntry}>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          This will permanently delete the selected matrix history entry and
          rewrite `history.xlsx`. This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button
            appearance="secondary"
            onClick={() => setIsConfirmDeleteOpen(false)}
            disabled={isDeletingMatrixEntry}
          >
            Cancel
          </Button>
          <Button
            appearance="primary"
            onClick={handleConfirmDeleteMatrixEntry}
            disabled={isDeletingMatrixEntry}
          >
            {isDeletingMatrixEntry ? <Spinner size="tiny" /> : "Delete"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Landing;
