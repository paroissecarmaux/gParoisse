import { LayoutList } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function AllGroupsPage() {
  return (
    <PagePlaceholder
      title="Tous les groupes"
      description="La liste complète des groupes et activités de la paroisse s'affichera ici."
      icon={LayoutList}
    />
  );
}
