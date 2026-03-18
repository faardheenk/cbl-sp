import React, { useState } from "react";
import styles from "./Reconciliation.module.scss";
import { saveExcel } from "../../../utils/saveExcel";
import { SaveRegular, ArrowUndoRegular } from "@fluentui/react-icons";
import { cleanData } from "../../../utils/cleanData";
import { useSpContext } from "../../../SpContext";
import { useChanges } from "../../../context/ChangesContext";
import { useReconciliation } from "../../../context/ReconciliationContext";
import {
  Button,
  Spinner,
  Toast,
  ToastTitle,
  useId,
  useToastController,
  ToastBody,
  Tooltip,
} from "@fluentui/react-components";
import { addPostfix, mergeData } from "../../../utils/filterData";
import UndoModal from "./UndoModal";
import { saveMatchHistory } from "../../../utils/matchHistory";

type SaveChangesProps = {
  onUndo?: (actionIds: string[]) => void;
};

function SaveChanges({ onUndo }: SaveChangesProps) {
  const { context, sp } = useSpContext();
  const { changes, setChanges } = useChanges();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUndoModalOpen, setIsUndoModalOpen] = useState<boolean>(false);
  const {
    exactMatchCBL,
    exactMatchInsurer,
    partialMatchCBL,
    partialMatchInsurer,
    noMatchCBL,
    noMatchInsurer,
    exactMatchSum1,
    exactMatchSum2,
    partialMatchSum1,
    partialMatchSum2,
    noMatchSum1,
    noMatchSum2,
    actionHistory,
    matchHistoryEntries,
    setMatchHistoryEntries,
    dynamicBuckets,
    dynamicBucketData,
  } = useReconciliation();

  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);

  const urlParams = new URLSearchParams(window.location.search);
  const insuranceName = urlParams.get("Insurance");
  const date = urlParams.get("Date");

  const handleUndoClick = () => {
    setIsUndoModalOpen(true);
  };

  const handleUndoClose = () => {
    setIsUndoModalOpen(false);
  };

  const handleUndo = (actionIds: string[]) => {
    console.log("SaveChanges handleUndo called with:", actionIds);
    console.log("onUndo prop exists:", !!onUndo);
    if (onUndo) {
      console.log("Calling onUndo...");
      onUndo(actionIds);
      console.log("onUndo called");
    }
  };

  return (
    <>
      <div style={{ display: "flex", gap: "8px" }}>
        <Tooltip
          content={
            actionHistory.length === 0
              ? "No actions to undo"
              : `${actionHistory.length} action${
                  actionHistory.length !== 1 ? "s" : ""
                } available to undo`
          }
          relationship="label"
        >
          <Button
            icon={<ArrowUndoRegular fontSize={20} />}
            size="small"
            className={styles.btn}
            appearance="secondary"
            disabled={actionHistory.length === 0}
            onClick={handleUndoClick}
          >
            Undo
          </Button>
        </Tooltip>

        <Button
          icon={
            isSaving ? <Spinner size="tiny" /> : <SaveRegular fontSize={24} />
          }
          size="small"
          className={styles.btn}
          appearance="primary"
          disabled={!changes || isSaving}
          onClick={async () => {
            setChanges(false);
            setIsSaving(true);

            const mergedExactMatch = mergeData(
              exactMatchCBL,
              exactMatchInsurer
            );
            const mergedPartialMatch = mergeData(
              partialMatchCBL,
              partialMatchInsurer
            );
            const addPostfixNoMatchInsurer = addPostfix(noMatchInsurer);
            const dynamicBucketSheets = dynamicBuckets.reduce<
              Record<string, any[]>
            >((acc, bucket) => {
              const bucketRows = dynamicBucketData[bucket.BucketKey] || {
                cbl: [],
                insurer: [],
              };
              acc[bucket.BucketKey] = mergeData(
                bucketRows.cbl,
                bucketRows.insurer,
              );
              return acc;
            }, {});

            console.log("mergedExactMatch >>> ", mergedExactMatch);
            console.log("mergedPartialMatch >>> ", mergedPartialMatch);

            try {
              // Save Excel file
              const res = await saveExcel(
                sp,
                mergedExactMatch,
                mergedPartialMatch,
                noMatchCBL,
                addPostfixNoMatchInsurer,
                exactMatchSum1,
                exactMatchSum2,
                partialMatchSum1,
                partialMatchSum2,
                noMatchSum1,
                noMatchSum2,
                insuranceName || "",
                `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/${insuranceName}/${date}`,
                dynamicBuckets,
                dynamicBucketSheets,
              );

              if (res.status === 200) {
                // Save match history for cross-session persistence
                console.log("[Match History] Entries to save:", matchHistoryEntries.length, matchHistoryEntries);
                await saveMatchHistory(
                  sp,
                  matchHistoryEntries,
                  (insuranceName || "").toUpperCase().trim(),
                  context.pageContext.web.serverRelativeUrl,
                );
                setMatchHistoryEntries([]);

                dispatchToast(
                  <Toast className="bg-success text-white rounded-3">
                    <ToastTitle>Saved Successfully</ToastTitle>
                  </Toast>,
                  { position: "top", intent: "success" }
                );
              } else {
                dispatchToast(
                  <Toast className="bg-danger text-white rounded-3">
                    <ToastTitle>Error saving changes</ToastTitle>
                    <ToastBody className="fs-3">
                      Cannot save changes because the excel file is open
                    </ToastBody>
                  </Toast>,
                  { position: "top", intent: "error" }
                );
              }
            } catch (error) {
              console.error("Error during save:", error);
              dispatchToast(
                <Toast className="bg-danger text-white rounded-3">
                  <ToastTitle>Error saving changes</ToastTitle>
                  <ToastBody className="fs-3">
                    An error occurred while saving
                  </ToastBody>
                </Toast>,
                { position: "top", intent: "error" }
              );
            } finally {
              setIsSaving(false);
            }
          }}
        >
          Save
        </Button>
      </div>

      <UndoModal
        isOpen={isUndoModalOpen}
        onClose={handleUndoClose}
        onUndo={handleUndo}
      />
    </>
  );
}

export default SaveChanges;
