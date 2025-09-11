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
import { IListItemFormUpdateValue } from "@pnp/sp/lists";

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
    matrix,
  } = useReconciliation();

  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);

  const urlParams = new URLSearchParams(window.location.search);
  const insuranceName = urlParams.get("Insurance");
  const date = urlParams.get("Date");

  const addMatrixKeys = async () => {
    if (!matrix || matrix.length === 0) {
      return;
    }

    try {
      const list = await sp.web.lists.getByTitle("Matrix");

      // Create folder path for the insurance if it doesn't exist
      const folderServerRelativePath = `${context.pageContext.web.serverRelativeUrl}/Lists/Matrix/${insuranceName}`;

      // Add each matrix key as a separate item
      for (const matrixKey of matrix) {
        const formValues: IListItemFormUpdateValue[] = [
          { FieldName: "Title", FieldValue: matrixKey },
          // { FieldName: "Insurance", FieldValue: insuranceName },
          // { FieldName: "Date", FieldValue: date },
        ];

        await list.addValidateUpdateItemUsingPath(
          formValues,
          folderServerRelativePath
        );
      }

      console.log("Matrix keys added successfully");
    } catch (error) {
      console.error("Error adding matrix keys:", error);
      throw error;
    }
  };

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

        const mergedExactMatch = mergeData(exactMatchCBL, exactMatchInsurer);
        const mergedPartialMatch = mergeData(
          partialMatchCBL,
          partialMatchInsurer
        );
        const addPostfixNoMatchInsurer = addPostfix(noMatchInsurer);

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
            `${context.pageContext.web.serverRelativeUrl}/Reconciliation Library/${insuranceName}/${date}`
          );

          if (res.status === 200) {
            // Save matrix keys to SharePoint
            await addMatrixKeys();

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
  );
}

export default SaveChanges;
