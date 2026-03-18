import React, { createContext, useContext, useState, ReactNode } from "react";
import { ColumnsType } from "antd/es/table";
import { MatchHistoryEntry } from "../utils/matchHistory";
import {
  BucketKey,
  BucketRows,
  DynamicBucketDefinition,
} from "../utils/reconciliationBuckets";

// Action history item type for undo functionality
export interface ActionHistoryItem {
  id: string;
  timestamp: Date;
  actionType: "moveToPartial" | "moveToExact" | "unmatch" | "moveToBucket";
  fromSection: BucketKey;
  toSection: BucketKey;
  cblRows: any[];
  insurerRows: any[];
  // Original indices in the source array (for restoring at exact position)
  cblRowIndices: number[];
  insurerRowIndices: number[];
  matrixKey: string;
}

interface ReconciliationContextType {
  // Exact match states
  exactMatchCBL: any[];
  setExactMatchCBL: React.Dispatch<React.SetStateAction<any[]>>;
  exactMatchInsurer: any[];
  setExactMatchInsurer: React.Dispatch<React.SetStateAction<any[]>>;

  // Partial match states
  partialMatchCBL: any[];
  setPartialMatchCBL: React.Dispatch<React.SetStateAction<any[]>>;
  partialMatchInsurer: any[];
  setPartialMatchInsurer: React.Dispatch<React.SetStateAction<any[]>>;

  // Selected row states
  selectedRowCBL: any[];
  setSelectedRowCBL: React.Dispatch<React.SetStateAction<any[]>>;
  selectedRowInsurer: any[];
  setSelectedRowInsurer: React.Dispatch<React.SetStateAction<any[]>>;

  // No match states
  noMatchCBL: any[];
  setNoMatchCBL: React.Dispatch<React.SetStateAction<any[]>>;
  noMatchInsurer: any[];
  setNoMatchInsurer: React.Dispatch<React.SetStateAction<any[]>>;

  // Dynamic bucket states
  dynamicBuckets: DynamicBucketDefinition[];
  setDynamicBuckets: React.Dispatch<
    React.SetStateAction<DynamicBucketDefinition[]>
  >;
  dynamicBucketData: Record<string, BucketRows>;
  setDynamicBucketData: React.Dispatch<
    React.SetStateAction<Record<string, BucketRows>>
  >;

  // Sum states
  partialMatchSum1: number;
  setPartialMatchSum1: React.Dispatch<React.SetStateAction<number>>;
  partialMatchSum2: number;
  setPartialMatchSum2: React.Dispatch<React.SetStateAction<number>>;
  noMatchSum1: number;
  setNoMatchSum1: React.Dispatch<React.SetStateAction<number>>;
  noMatchSum2: number;
  setNoMatchSum2: React.Dispatch<React.SetStateAction<number>>;
  exactMatchSum1: number;
  setExactMatchSum1: React.Dispatch<React.SetStateAction<number>>;
  exactMatchSum2: number;
  setExactMatchSum2: React.Dispatch<React.SetStateAction<number>>;

  // Matrix
  matrix: any[];
  setMatrix: React.Dispatch<React.SetStateAction<any[]>>;

  // UI states
  isClicked: boolean;
  setIsClicked: React.Dispatch<React.SetStateAction<boolean>>;
  uploadSuccess: boolean;
  setUploadSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  uploadError: string | null;
  setUploadError: React.Dispatch<React.SetStateAction<string | null>>;
  currentManualMatchGroup: number;
  setCurrentManualMatchGroup: React.Dispatch<React.SetStateAction<number>>;

  // Search states
  partialMatchSearch1: string;
  setPartialMatchSearch1: React.Dispatch<React.SetStateAction<string>>;
  partialMatchSearch2: string;
  setPartialMatchSearch2: React.Dispatch<React.SetStateAction<string>>;
  noMatchSearch1: string;
  setNoMatchSearch1: React.Dispatch<React.SetStateAction<string>>;
  noMatchSearch2: string;
  setNoMatchSearch2: React.Dispatch<React.SetStateAction<string>>;
  exactMatchSearch1: string;
  setExactMatchSearch1: React.Dispatch<React.SetStateAction<string>>;
  exactMatchSearch2: string;
  setExactMatchSearch2: React.Dispatch<React.SetStateAction<string>>;

  // Column mapping states
  cblColumns: ColumnsType;
  setCblColumns: React.Dispatch<React.SetStateAction<ColumnsType>>;
  insurerColumns: ColumnsType;
  setInsurerColumns: React.Dispatch<React.SetStateAction<ColumnsType>>;

  // Clear selections trigger
  clearAllSelections: boolean;
  setClearAllSelections: React.Dispatch<React.SetStateAction<boolean>>;

  // Action history for undo functionality
  actionHistory: ActionHistoryItem[];
  setActionHistory: React.Dispatch<React.SetStateAction<ActionHistoryItem[]>>;
  addToHistory: (item: Omit<ActionHistoryItem, "id" | "timestamp">) => void;
  removeFromHistory: (ids: string[]) => void;
  clearHistory: () => void;

  // Match history for cross-session persistence
  matchHistoryEntries: MatchHistoryEntry[];
  setMatchHistoryEntries: React.Dispatch<React.SetStateAction<MatchHistoryEntry[]>>;
  addMatchHistoryEntry: (entry: MatchHistoryEntry) => void;
}

const ReconciliationContext = createContext<
  ReconciliationContextType | undefined
>(undefined);

export const ReconciliationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Exact match states
  const [exactMatchCBL, setExactMatchCBL] = useState<any[]>([]);
  const [exactMatchInsurer, setExactMatchInsurer] = useState<any[]>([]);

  // Partial match states
  const [partialMatchCBL, setPartialMatchCBL] = useState<any[]>([]);
  const [partialMatchInsurer, setPartialMatchInsurer] = useState<any[]>([]);

  // Selected row states
  const [selectedRowCBL, setSelectedRowCBL] = useState<any[]>([]);
  const [selectedRowInsurer, setSelectedRowInsurer] = useState<any[]>([]);

  // No match states
  const [noMatchCBL, setNoMatchCBL] = useState<any[]>([]);
  const [noMatchInsurer, setNoMatchInsurer] = useState<any[]>([]);
  const [dynamicBuckets, setDynamicBuckets] = useState<DynamicBucketDefinition[]>(
    [],
  );
  const [dynamicBucketData, setDynamicBucketData] = useState<
    Record<string, BucketRows>
  >({});

  // Matrix
  const [matrix, setMatrix] = useState<any[]>([]);

  // Sum states
  const [partialMatchSum1, setPartialMatchSum1] = useState<number>(0);
  const [partialMatchSum2, setPartialMatchSum2] = useState<number>(0);
  const [noMatchSum1, setNoMatchSum1] = useState<number>(0);
  const [noMatchSum2, setNoMatchSum2] = useState<number>(0);
  const [exactMatchSum1, setExactMatchSum1] = useState<number>(0);
  const [exactMatchSum2, setExactMatchSum2] = useState<number>(0);

  // UI states
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentManualMatchGroup, setCurrentManualMatchGroup] =
    useState<number>(1);

  // Search states
  const [partialMatchSearch1, setPartialMatchSearch1] = useState<string>("");
  const [partialMatchSearch2, setPartialMatchSearch2] = useState<string>("");
  const [noMatchSearch1, setNoMatchSearch1] = useState<string>("");
  const [noMatchSearch2, setNoMatchSearch2] = useState<string>("");
  const [exactMatchSearch1, setExactMatchSearch1] = useState<string>("");
  const [exactMatchSearch2, setExactMatchSearch2] = useState<string>("");

  // Column mapping states
  const [cblColumns, setCblColumns] = useState<ColumnsType>([]);
  const [insurerColumns, setInsurerColumns] = useState<ColumnsType>([]);

  // Clear selections trigger
  const [clearAllSelections, setClearAllSelections] = useState<boolean>(false);

  // Action history for undo functionality
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);

  const addToHistory = (item: Omit<ActionHistoryItem, "id" | "timestamp">) => {
    const newItem: ActionHistoryItem = {
      ...item,
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setActionHistory((prev) => [...prev, newItem]);
  };

  const removeFromHistory = (ids: string[]) => {
    setActionHistory((prev) => prev.filter((item) => !ids.includes(item.id)));
  };

  const clearHistory = () => {
    setActionHistory([]);
  };

  // Match history for cross-session persistence
  const [matchHistoryEntries, setMatchHistoryEntries] = useState<MatchHistoryEntry[]>([]);

  const addMatchHistoryEntry = (entry: MatchHistoryEntry) => {
    setMatchHistoryEntries((prev) => [...prev, entry]);
  };

  return (
    <ReconciliationContext.Provider
      value={{
        // Exact match states
        exactMatchCBL,
        setExactMatchCBL,
        exactMatchInsurer,
        setExactMatchInsurer,

        // Partial match states
        partialMatchCBL,
        setPartialMatchCBL,
        partialMatchInsurer,
        setPartialMatchInsurer,

        // Selected row states
        selectedRowCBL,
        setSelectedRowCBL,
        selectedRowInsurer,
        setSelectedRowInsurer,

        // No match states
        noMatchCBL,
        setNoMatchCBL,
        noMatchInsurer,
        setNoMatchInsurer,
        dynamicBuckets,
        setDynamicBuckets,
        dynamicBucketData,
        setDynamicBucketData,

        // Sum states
        partialMatchSum1,
        setPartialMatchSum1,
        partialMatchSum2,
        setPartialMatchSum2,
        noMatchSum1,
        setNoMatchSum1,
        noMatchSum2,
        setNoMatchSum2,
        exactMatchSum1,
        setExactMatchSum1,
        exactMatchSum2,
        setExactMatchSum2,

        // Matrix
        matrix,
        setMatrix,

        // UI states
        isClicked,
        setIsClicked,
        uploadSuccess,
        setUploadSuccess,
        uploadError,
        setUploadError,
        currentManualMatchGroup,
        setCurrentManualMatchGroup,

        // Search states
        partialMatchSearch1,
        setPartialMatchSearch1,
        partialMatchSearch2,
        setPartialMatchSearch2,
        noMatchSearch1,
        setNoMatchSearch1,
        noMatchSearch2,
        setNoMatchSearch2,
        exactMatchSearch1,
        setExactMatchSearch1,
        exactMatchSearch2,
        setExactMatchSearch2,

        // Column mapping states
        cblColumns,
        setCblColumns,
        insurerColumns,
        setInsurerColumns,

        // Clear selections trigger
        clearAllSelections,
        setClearAllSelections,

        // Action history for undo functionality
        actionHistory,
        setActionHistory,
        addToHistory,
        removeFromHistory,
        clearHistory,

        // Match history for cross-session persistence
        matchHistoryEntries,
        setMatchHistoryEntries,
        addMatchHistoryEntry,
      }}
    >
      {children}
    </ReconciliationContext.Provider>
  );
};

export const useReconciliation = (): ReconciliationContextType => {
  const context = useContext(ReconciliationContext);
  if (context === undefined) {
    throw new Error(
      "useReconciliation must be used within a ReconciliationProvider"
    );
  }
  return context;
};
