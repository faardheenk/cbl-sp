import React, { useMemo } from "react";
import styles from "./OnboardingInsurance.module.scss";
import { Spinner } from "@fluentui/react-components";
import { Button } from "antd";
import {
  DeleteRegular,
  EditRegular,
  AddRegular,
} from "@fluentui/react-icons";

export type SavedMapping = {
  Id: number;
  Title: string;
  ColumnMappings: string;
};

type Props = {
  savedMappings: SavedMapping[];
  cblMapping: Record<string, string>;
  isLoading: boolean;
  onCreateNew: () => void;
  onEdit: (mapping: SavedMapping) => void;
  onDelete: (mapping: SavedMapping) => void;
};

export default function InsuranceMappingsList({
  savedMappings,
  cblMapping,
  isLoading,
  onCreateNew,
  onEdit,
  onDelete,
}: Props) {
  // Reverse lookup: standard field name -> CBL column name
  // e.g. "PlacingNo" -> "Placing/Endorsement No."
  const reverseCblLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    for (const [cblColumn, standardField] of Object.entries(cblMapping)) {
      lookup[standardField] = cblColumn;
    }
    return lookup;
  }, [cblMapping]);

  const resolveCblColumnName = (standardField: string): string => {
    // Strip PolicyNo suffixes (e.g. PolicyNo_1 -> PolicyNo)
    const base = standardField.replace(/_\d+$/, "");
    return reverseCblLookup[base] || standardField;
  };

  const parseMappingColumns = (
    columnMappings: string,
  ): Record<string, string | string[]> => {
    try {
      return JSON.parse(columnMappings || "{}");
    } catch {
      return {};
    }
  };

  return (
    <div className={styles["mapping-container"]}>
      <div className={styles["list-header"]}>
        <h5 className="mb-0">Saved Insurance Mappings</h5>
        <Button
          type="primary"
          icon={<AddRegular />}
          onClick={onCreateNew}
        >
          Onboard New Insurance
        </Button>
      </div>

      <div className={styles["mapping-wrapper"]}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <Spinner size="small" />
          </div>
        ) : savedMappings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
            No mappings found
          </div>
        ) : (
          savedMappings.map((mapping) => {
            const parsed = parseMappingColumns(mapping.ColumnMappings);
            const entries = Object.entries(parsed);

            return (
              <div key={mapping.Id} className={styles["mapping-lists"]}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: "8px" }}>
                    {mapping.Title}
                  </div>
                  <div className={styles["mapping-detail-list"]}>
                    {entries.map(([insurerCol, cblFieldValue]) => {
                      const fields = Array.isArray(cblFieldValue)
                        ? cblFieldValue
                        : [cblFieldValue];

                      return fields.map((field, i) => (
                        <div
                          key={`${insurerCol}-${i}`}
                          className={styles["mapping-detail-row"]}
                        >
                          <span className={styles["insurer-col"]}>
                            {insurerCol}
                          </span>
                          <span className={styles["arrow"]}>&rarr;</span>
                          <span className={styles["cbl-col"]}>
                            {resolveCblColumnName(field)}
                          </span>
                        </div>
                      ));
                    })}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignSelf: "flex-start",
                  }}
                >
                  <Button
                    icon={<EditRegular />}
                    onClick={() => onEdit(mapping)}
                  />
                  <Button
                    icon={<DeleteRegular />}
                    danger
                    onClick={() => {
                      if (
                        window.confirm(
                          `Are you sure you want to delete the mapping for "${mapping.Title}"?`,
                        )
                      ) {
                        onDelete(mapping);
                      }
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
