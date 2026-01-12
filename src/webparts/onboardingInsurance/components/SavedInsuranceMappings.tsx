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
  const [cblMapping, setCblMapping] = useState<string>("");
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Helper function to format mapping values
  const formatMappingValues = (value: any): string[] => {
    if (Array.isArray(value)) {
      return value;
    } else if (typeof value === "string" && value.includes(",")) {
      return value.split(",").map((v) => v.trim());
    } else {
      return [value as string];
    }
  };

  const convertInsurerMappingToCBLStandard = (
    savedMapping: any,
    cblMapping: any
  ) => {
    const result: { [key: string]: string } = {};

    let parsedSavedMapping: { [key: string]: any };
    try {
      parsedSavedMapping = JSON.parse(savedMapping || "{}");
    } catch (error) {
      parsedSavedMapping = {};
    }

    let parsedCblMapping: { [key: string]: any };
    try {
      parsedCblMapping = JSON.parse(cblMapping || "{}");
    } catch (error) {
      parsedCblMapping = {};
    }

    Object.entries(parsedSavedMapping).forEach(([savedKey, savedValue]) => {
      const baseValue = savedValue.toString().replace(/_\d+$/, "");

      const cblKey = Object.keys(parsedCblMapping).find(
        (key) => parsedCblMapping[key] === baseValue
      );

      if (cblKey) {
        result[savedKey] = cblKey;
      }
    });

    return result;
  };

  const fetchSavedInsuranceMappings = async () => {
    setIsFetching(true);

    const mappings = await sp.web.lists
      .getByTitle("Mappings")
      .items.select("Title, ColumnMappings")();

    console.log(mappings);

    // Separate CBL mapping from other mappings
    const cblMappingItem = mappings.find((mapping) => mapping.Title === "CBL");
    const otherMappings = mappings.filter((mapping) => mapping.Title !== "CBL");

    setCblMapping(cblMappingItem?.ColumnMappings || "");
    setSavedInsuranceMappings(otherMappings);
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
      <h5 className="mb-4">Saved Insurance Mappings</h5>
      <div className={styles["mapping-wrapper"]}>
        {isFetching ? (
          <Spinner size="small" />
        ) : savedInsuranceMappings.filter(
            (savedInsuranceMapping) => savedInsuranceMapping.Title !== "CBL"
          ).length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
            No mappings found
          </div>
        ) : (
          savedInsuranceMappings
            .filter(
              (savedInsuranceMapping) => savedInsuranceMapping.Title !== "CBL"
            )
            .map((savedInsuranceMapping) => {
              // Create 3-way mapping using CBL mapping
              const threeWayMappings = convertInsurerMappingToCBLStandard(
                savedInsuranceMapping.ColumnMappings,
                cblMapping
              );

              return (
                <div key={savedInsuranceMapping.Title}>
                  {savedInsuranceMapping.ColumnMappings ? (
                    <div className={styles["mapping-lists"]}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: "8px" }}>
                          {savedInsuranceMapping.Title}
                        </div>
                        <div style={{ fontSize: "13px", color: "#666" }}>
                          {Object.entries(threeWayMappings).map(
                            ([key, value], index) => {
                              const targetValues = formatMappingValues(value);
                              return (
                                <div
                                  key={index}
                                  style={{ marginBottom: "4px" }}
                                >
                                  <span style={{ fontWeight: 500 }}>{key}</span>{" "}
                                  → <span>{targetValues.join(", ")}</span>
                                </div>
                              );
                            }
                          )}
                        </div>
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
              );
            })
        )}
      </div>
    </div>
  );
}
