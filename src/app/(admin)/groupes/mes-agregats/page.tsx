import { Star } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function MyAggregatesPage() {
  return (
    <PagePlaceholder
      title="Mes agrégats"
      description="Les groupes que vous suivez personnellement s'afficheront ici."
      icon={Star}
    />
  );
}
