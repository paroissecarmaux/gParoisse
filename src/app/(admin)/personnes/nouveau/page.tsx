import { UserPlus } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function CreatePersonPage() {
  return (
    <PagePlaceholder
      title="Créer une personne"
      description="Le formulaire de création d'une nouvelle personne (identité, foyer, coordonnées) s'affichera ici."
      icon={UserPlus}
    />
  );
}
