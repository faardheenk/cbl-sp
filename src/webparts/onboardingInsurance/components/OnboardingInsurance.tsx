import React, { useState } from "react";
import MapInsuranceColumns from "./MapInsuranceColumns";
import SavedInsuranceMappings from "./SavedInsuranceMappings";
import Header from "../../common/Header";
import { Container } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

export default function OnboardingInsurance() {
  const [isSaving, setIsSaving] = useState<boolean>(false);

  return (
    <Container fluid>
      <Header />
      <MapInsuranceColumns isSaving={isSaving} setIsSaving={setIsSaving} />
      <SavedInsuranceMappings isSaving={isSaving} />
    </Container>
  );
}
