import { Users } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function AllPersonsPage() {
  return (
    <PagePlaceholder
      title="Toutes les personnes"
      description="La liste complète des personnes du fichier paroissial s'affichera ici, avec recherche et filtres."
      icon={Users}
    />
  );
}
