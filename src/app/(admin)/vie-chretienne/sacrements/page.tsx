import { Cross } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function SacramentsPage() {
  return (
    <PagePlaceholder
      title="Sacrements"
      description="Le suivi des baptêmes, mariages, confirmations et eucharisties s'affichera ici."
      icon={Cross}
    />
  );
}
