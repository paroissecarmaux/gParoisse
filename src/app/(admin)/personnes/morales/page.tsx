import { Building2 } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function LegalEntitiesPage() {
  return (
    <PagePlaceholder
      title="Personnes morales"
      description="Les associations, entreprises et autres entités liées à la paroisse s'afficheront ici."
      icon={Building2}
    />
  );
}
