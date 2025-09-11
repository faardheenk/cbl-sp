import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import styles from "./Landing.module.scss";
import { Container, Card, Badge } from "react-bootstrap";

import Header from "../../common/Header";
import { useTasks } from "../../../context/TaskContext";
import { useSpContext } from "../../../SpContext";
import { IFolderInfo } from "@pnp/sp/folders";
import DataTable, { TableColumn } from "react-data-table-component";

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

  const columns: TableColumn<any>[] = [
    {
      name: "Date",
      selector: (row: any) => row.date,
    },
    {
      name: "Insurance",
      selector: (row: any) => row.insurance,
    },

    {
      name: "Status",
      cell: (row: any) => (
        <Badge bg={badgeVariant(row.status)} style={{ padding: "0.5rem" }}>
          {row.status}
        </Badge>
      ),
    },
    {
      name: "Action",
      cell: (row: any) => (
        <a href={row.url} target="_blank" rel="noopener noreferrer">
          View
        </a>
      ),
      right: true,
    },
  ];

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
                    .getFolderByServerRelativePath(dateFolder.ServerRelativeUrl)
                    .listItemAllFields();
                  const status = folderProps.Status || "Pending";

                  return {
                    date: dateFolder.Name.split("_")[0],
                    insurance: insuranceName,
                    status: status as
                      | "Pending"
                      | "In Progress"
                      | "Manual Review"
                      | "Completed"
                      | "Failed",
                    url: `${context.pageContext.web.absoluteUrl}/SitePages/Reconciliation.aspx?Insurance=${insuranceName}&Date=${dateFolder.Name}`,
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

  useEffect(() => {
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
          <DataTable columns={columns} data={tasks} pagination />
        </div>
      </Card>
    </Container>
  );
};

export default Landing;
