import React, { useEffect, useState } from "react";
import styles from "./OnboardingInsurance.module.scss";
import { useSpContext } from "../../../SpContext";
import { Spinner } from "@fluentui/react-components";
import { Button } from "antd";
import { DeleteRegular } from "@fluentui/react-icons";

type SavedInsuranceMappingType = {
  Title: string;
  ColumnMappings: string;
};

export default function SavedInsuranceMappings({
  isSaving,
}: {
  isSaving: boolean;
}) {
  const { sp } = useSpContext();
  const [savedInsuranceMappings, setSavedInsuranceMappings] = useState<
    SavedInsuranceMappingType[]
  >([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchSavedInsuranceMappings = async () => {
    setIsFetching(true);

    const mappings = await sp.web.lists
      .getByTitle("Mappings")
      .items.filter(`Title ne 'CBL'`)();

    setSavedInsuranceMappings(mappings);
    setIsFetching(false);
  };

  useEffect(() => {
    fetchSavedInsuranceMappings();
  }, [isSaving]);

  const deleteSavedInsuranceMapping = async (title: string) => {
    try {
      setIsDeleting(true);

      const item = await sp.web.lists
        .getByTitle("Mappings")
        .items.filter(`Title eq '${title}'`)();

      console.log(item);

      if (item.length > 0) {
        await sp.web.lists
          .getByTitle("Mappings")
          .items.getById(item[0].Id)
          .delete();

        // Only fetch if deletion was successful
        await fetchSavedInsuranceMappings();
      }
    } catch (error) {
      console.error("Error deleting mapping:", error);
      // Handle error (you might want to show a toast notification)
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles["mapping-container"]}>
      <h2>Saved Insurance Mappings</h2>
      <div className={styles["mapping-wrapper"]}>
        {isFetching ? (
          <Spinner size="small" />
        ) : (
          savedInsuranceMappings.map((savedInsuranceMapping) => (
            <div key={savedInsuranceMapping.Title}>
              {savedInsuranceMapping.ColumnMappings ? (
                <div className={styles["mapping-lists"]}>
                  <div>
                    {savedInsuranceMapping.Title} :{" "}
                    {savedInsuranceMapping.ColumnMappings}
                  </div>

                  <div>
                    <Button
                      icon={<DeleteRegular />}
                      disabled={isDeleting}
                      onClick={() => {
                        deleteSavedInsuranceMapping(
                          savedInsuranceMapping.Title
                        );
                      }}
                    ></Button>
                  </div>
                </div>
              ) : (
                <div>No mappings found</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
