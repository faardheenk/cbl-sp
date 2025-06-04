import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import styles from "./Landing.module.scss";
import { Container, Button, Card, Table, Badge } from "react-bootstrap";
import Header from "../../common/Header";
import { useTasks } from "../../../context/TaskContext";
import { useSpContext } from "../../../SpContext";
import { IFolderInfo } from "@pnp/sp/folders";

const COLORS = {
  primary: "#5A6374", // muted slate gray
  secondary: "#8D8D92", // soft gray
  lightBg: "#F9FAFB", // very light gray
  headerText: "#2C2E33", // dark charcoal
  tableHeaderBg: "#E5E7EB", // light gray
};

const Landing = () => {
  console.log("styles >> ", styles);

  const { context, sp } = useSpContext();
  const { tasks, setTasks } = useTasks();

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("_");
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        // Get the document library
        const docLib = await sp.web.lists.getByTitle("Reconciliation Library");

        // Get all folders (insurance names) from the library
        const folders = await docLib.rootFolder.folders();
        console.log("FOLDERS >>> ", folders);

        // Transform the folders into our task format
        const allTasks = await Promise.all(
          folders.map(async (folder: IFolderInfo) => {
            // Get insurance name from folder name
            const insuranceName = folder.Name;

            // Get all date subfolders for this insurance
            try {
              const subFolders = await sp.web
                .getFolderByServerRelativePath(folder.ServerRelativeUrl)
                .folders();

              return await Promise.all(
                subFolders
                  .filter(
                    (dateFolder: IFolderInfo) => dateFolder.Name !== "Document"
                  )
                  .map(async (dateFolder: IFolderInfo) => {
                    // Get folder properties to access status
                    const folderProps = await sp.web
                      .getFolderByServerRelativePath(
                        dateFolder.ServerRelativeUrl
                      )
                      .listItemAllFields();
                    const status = folderProps.Status || "Pending";

                    return {
                      date: formatDate(dateFolder.Name),
                      insurance: insuranceName,
                      status: status as
                        | "Pending"
                        | "In Progress"
                        | "Manual Review"
                        | "Completed"
                        | "Failed",
                      url: `${context.pageContext.web.absoluteUrl}/SitePages/Reconciliation.aspx?Insurance=${insuranceName}`,
                    };
                  })
              );
            } catch (error) {
              console.error("Error getting subfolders:", error);
              return [
                {
                  date: "No date",
                  insurance: insuranceName,
                  status: "Pending" as const,
                  url: `${context.pageContext.web.absoluteUrl}/SitePages/Reconciliation.aspx?Insurance=${insuranceName}`,
                },
              ];
            }
          })
        );

        // Flatten the array of arrays into a single array of tasks
        const transformedTasks = allTasks.reduce(
          (acc, curr) => [...acc, ...curr],
          []
        );

        // Sort tasks by date in descending order
        transformedTasks.sort((a, b) => b.date.localeCompare(a.date));

        setTasks(transformedTasks);
      } catch (error) {
        console.error("Error fetching from Reconciliation Library:", error);
      }
    };
    fetchTasks();
  }, []);

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
      }}
    >
      <Header />

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
