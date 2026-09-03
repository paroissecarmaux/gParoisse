import { Layers } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function ManageGroupsPage() {
  return (
    <PagePlaceholder
      title="Gérer les groupes"
      description="La création et l'administration des groupes et activités se feront ici."
      icon={Layers}
    />
  );
}
