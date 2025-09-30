import React, { useState } from "react";
import MapInsuranceColumns from "./MapInsuranceColumns";
import SavedInsuranceMappings from "./SavedInsuranceMappings";

export default function OnboardingInsurance() {
  const [isSaving, setIsSaving] = useState<boolean>(false);

  return (
    <>
      <MapInsuranceColumns isSaving={isSaving} setIsSaving={setIsSaving} />
      <SavedInsuranceMappings isSaving={isSaving} />
    </>
  );
}
