import React, { useState, useEffect, useCallback } from "react";
import Header from "../../common/Header";
import { Container } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import { useSpContext } from "../../../SpContext";
import InsuranceMappingsList, {
  type SavedMapping,
} from "./InsuranceMappingsList";
import InsuranceMappingForm from "./InsuranceMappingForm";

type ViewMode = "list" | "create" | "edit";

export default function OnboardingInsurance() {
  const { sp } = useSpContext();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [cblFields, setCblFields] = useState<string[]>([]);
  const [cblMapping, setCblMapping] = useState<Record<string, string>>({});
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);
  const [editingMapping, setEditingMapping] = useState<SavedMapping | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const items: any[] = await sp.web.lists
        .getByTitle("Mappings")
        .items.select("Id", "Title", "ColumnMappings")();

      const cblItem = items.find((item) => item.Title === "CBL");
      if (cblItem?.ColumnMappings) {
        const parsed: Record<string, string> = JSON.parse(cblItem.ColumnMappings);
        setCblMapping(parsed);
        const uniqueFields = Array.from(new Set<string>(Object.values(parsed)));
        setCblFields(uniqueFields);
      }

      const otherMappings = items
        .filter((item) => item.Title !== "CBL")
        .map((item) => ({
          Id: item.Id,
          Title: item.Title,
          ColumnMappings: item.ColumnMappings,
        }));

      setSavedMappings(otherMappings);
    } catch (error) {
      console.error("Failed to fetch mappings:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sp]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateNew = () => {
    setEditingMapping(null);
    setViewMode("create");
  };

  const handleEdit = (mapping: SavedMapping) => {
    setEditingMapping(mapping);
    setViewMode("edit");
  };

  const handleDelete = async (mapping: SavedMapping) => {
    try {
      await sp.web.lists
        .getByTitle("Mappings")
        .items.getById(mapping.Id)
        .delete();
      await fetchData();
    } catch (error) {
      console.error("Error deleting mapping:", error);
    }
  };

  const handleSaveComplete = async () => {
    await fetchData();
    setViewMode("list");
    setEditingMapping(null);
  };

  const handleCancel = () => {
    setViewMode("list");
    setEditingMapping(null);
  };

  return (
    <Container fluid>
      <Header />
      {viewMode === "list" && (
        <InsuranceMappingsList
          savedMappings={savedMappings}
          cblMapping={cblMapping}
          isLoading={isLoading}
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      {(viewMode === "create" || viewMode === "edit") && (
        <InsuranceMappingForm
          mode={viewMode}
          cblFields={cblFields}
          existingMapping={editingMapping}
          onSaveComplete={handleSaveComplete}
          onCancel={handleCancel}
        />
      )}
    </Container>
  );
}
