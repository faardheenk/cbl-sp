import React, { useState } from "react";
import styles from "./Reconciliation.module.scss";
import { saveExcel } from "../../../lib/saveExcel";
import { SaveRegular } from "@fluentui/react-icons";
import { cleanData } from "../../../lib/cleanData";
import { useSpContext } from "../../../SpContext";
import { useChanges } from "../../../context/ChangesContext";
import {
  Button,
  Spinner,
  Toast,
  ToastTitle,
  useId,
  useToastController,
  ToastBody,
} from "@fluentui/react-components";

type SaveChangesProps = {
  exactMatchCBL: any[];
  exactMatchInsurer: any[];
  partialMatchCBL: any[];
  partialMatchInsurer: any[];
  noMatchCBL: any[];
  noMatchInsurer: any[];
};

function SaveChanges({
  exactMatchCBL,
  exactMatchInsurer,
  partialMatchCBL,
  partialMatchInsurer,
  noMatchCBL,
  noMatchInsurer,
}: SaveChangesProps) {
  const { context, sp } = useSpContext();
  const { changes, setChanges } = useChanges();
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);
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
          cleanData(exactMatchCBL, exactMatchInsurer),
          cleanData(partialMatchCBL, partialMatchInsurer),
          cleanData(noMatchCBL, noMatchInsurer),
          cleanData(noMatchInsurer, noMatchCBL),
          `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/CBL_SWAN_17_APR_25`
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
