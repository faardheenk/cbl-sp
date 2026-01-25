import { WebPartContext } from "@microsoft/sp-webpart-base";
import React, { createContext, useContext, useState } from "react";
// import { useSpContext } from "../SpContext";

export interface Task {
  date?: string;
  insurance: string;
  status?: "Pending" | "In Progress" | "Manual Review" | "Completed" | "Failed";
  url?: string;
  createdDate?: Date;
  // Folder navigation properties
  name?: string;
  isFolder?: boolean;
  serverRelativeUrl?: string;
  path?: string;
  hasSubFolders?: boolean;
}

interface TaskContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  updateTaskStatus: (
    insurance: string,
    date: string,
    newStatus: Task["status"]
  ) => void;
}

type TaskContextProps = {
  children: React.ReactNode;
  context: WebPartContext;
};

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<TaskContextProps> = ({
  children,
  context,
}) => {
  // const { context } = useSpContext();
  const [tasks, setTasks] = useState<Task[]>([]);

  const updateTaskStatus = (
    insurance: string,
    date: string,
    newStatus: Task["status"]
  ) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.insurance === insurance && task.date === date
          ? { ...task, status: newStatus }
          : task
      )
    );
  };

  return (
    <TaskContext.Provider value={{ tasks, setTasks, updateTaskStatus }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error("useTasks must be used within a TaskProvider");
  }
  return context;
};
