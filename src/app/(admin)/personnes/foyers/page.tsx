import { Home } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function HouseholdsPage() {
  return (
    <PagePlaceholder
      title="Tous les foyers"
      description="La liste des foyers (personnes regroupées par domicile) s'affichera ici."
      icon={Home}
    />
  );
}
