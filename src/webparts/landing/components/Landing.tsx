import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

import styles from "./Landing.module.scss";

import { Container, Button, Card, Table, Badge } from "react-bootstrap";
import Header from "../../common/Header";
import { useTasks } from "../../../context/TaskContext";
import { useSpContext } from "../../../SpContext";

const COLORS = {
  primary: "#5A6374", // muted slate gray
  secondary: "#8D8D92", // soft gray
  lightBg: "#F9FAFB", // very light gray
  headerText: "#2C2E33", // dark charcoal
  tableHeaderBg: "#E5E7EB", // light gray
};

const Landing = () => {
  console.log("styles >> ", styles);

  const [showModal, setShowModal] = useState(false);
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [selectedInsurance, setSelectedInsurance] = useState("Swan");
  const { tasks, setTasks } = useTasks();
  const { context } = useSpContext();

  const handleOpen = () => {
    setShowModal(true);
  };

  const handleUpload = (
    file1: File | null,
    file2: File | null,
    selectedInsurance: string
  ) => {
    if (file1 && file2) {
      const now = new Date();
      const month = now.toLocaleString("default", { month: "short" });
      const year = now.getFullYear();
      const dateStr = `${month} ${year}`;
      setTasks((prev) => [
        {
          date: dateStr,
          insurance: selectedInsurance,
          status: "In Progress",
          url: `${context.pageContext.web.absoluteUrl}/SitePages/Reconciliation.aspx?Insurance=${selectedInsurance}`,
        },
        ...prev,
      ]);
    }
  };

  const badgeVariant = (status: string) => {
    if (status === "Completed") return "success";
    if (status === "Manual Review") return "primary";
    if (status === "In Progress") return "warning";
    return "secondary";
  };

  return (
    <Container
      fluid
      style={{
        backgroundColor: COLORS.lightBg,
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <Header
        title="Dashboard"
        actionButton={{
          label: "Upload Statements",
          onClick: handleOpen,
          icon: "bi-cloud-arrow-up",
          showUploadModal: true,
          onUpload: handleUpload,
          insuranceOptions: ["Swan", "MUA", "Sicom", "Eagle Insurance"],
        }}
      />

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
            borderless
            responsive
            style={{ borderCollapse: "separate", borderSpacing: "0 0.75rem" }}
          >
            <thead>
              <tr
                style={{
                  color: COLORS.headerText,
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                }}
              >
                <th style={{ padding: "0.75rem 1.5rem" }}>Date</th>
                <th style={{ padding: "0.75rem 1.5rem" }}>Insurance</th>
                <th style={{ padding: "0.75rem 1.5rem" }}>Status</th>
                <th style={{ padding: "0.75rem 1.5rem" }} />
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, idx) => (
                <tr
                  key={idx}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "0.75rem",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  <td
                    style={{ padding: "1rem 1.5rem", color: COLORS.headerText }}
                  >
                    {t.date}
                  </td>
                  <td
                    style={{ padding: "1rem 1.5rem", color: COLORS.headerText }}
                  >
                    {t.insurance}
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <Badge
                      bg={badgeVariant(t.status)}
                      pill
                      style={{ fontSize: "0.75rem", padding: "0.5rem 0.75rem" }}
                    >
                      {t.status}
                    </Badge>
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <Button
                      variant="outline-secondary"
                      style={{
                        borderColor: COLORS.secondary,
                        fontSize: "0.75rem",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                      }}
                      size="sm"
                      onClick={() => {
                        window.open(t.url, "_blank");
                      }}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div
          style={{
            padding: "1rem 2rem",
            color: COLORS.secondary,
            fontSize: "0.875rem",
          }}
        >
          Showing {tasks.length} items
        </div>
      </Card>
    </Container>
  );
};

export default Landing;
