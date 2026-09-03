import { UsersRound } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function GroupsPage() {
  return (
    <PagePlaceholder
      title="Les groupes"
      description="Un aperçu des groupes et activités auxquels vous participez s'affichera ici."
      icon={UsersRound}
    />
  );
}
