import React, { useState } from "react";
import styles from "./Reconciliation.module.scss";
import { saveExcel } from "../../../lib/saveExcel";
import { SaveRegular } from "@fluentui/react-icons";
import { cleanData } from "../../../lib/cleanData";
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
} from "@fluentui/react-components";
import { addPostfix, mergeData } from "../../../lib/filterData";

type SaveChangesProps = {};

function SaveChanges({}: SaveChangesProps) {
  const { context, sp } = useSpContext();
  const { changes, setChanges } = useChanges();
  const [isSaving, setIsSaving] = useState<boolean>(false);
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
  } = useReconciliation();

  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);

  const urlParams = new URLSearchParams(window.location.search);
  const insuranceName = urlParams.get("Insurance");
  const date = urlParams.get("Date");

  const mergedExactMatch = mergeData(exactMatchCBL, exactMatchInsurer);
  const mergedPartialMatch = mergeData(partialMatchCBL, partialMatchInsurer);
  const addPostfixNoMatchInsurer = addPostfix(noMatchInsurer);
  return (
    <Button
      icon={isSaving ? <Spinner size="tiny" /> : <SaveRegular fontSize={24} />}
      size="small"
      className={styles.btn}
      appearance="primary"
      disabled={!changes || isSaving}
      onClick={async () => {
        setChanges(false);
        setIsSaving(true);
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
          `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/${insuranceName}/${date}`
        );
        if (res.status === 200) {
          dispatchToast(
            <Toast className="bg-success text-white rounded-3">
              <ToastTitle>Saved Successfully</ToastTitle>
            </Toast>,
            { position: "top", intent: "success" }
          );
          setIsSaving(false);
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
          setIsSaving(false);
        }
      }}
    >
      Save
    </Button>
  );
}

export default SaveChanges;
