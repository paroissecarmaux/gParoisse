import { HeartHandshake } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function FuneralsPage() {
  return (
    <PagePlaceholder
      title="Funérailles"
      description="Le suivi des célébrations de funérailles s'affichera ici."
      icon={HeartHandshake}
    />
  );
}
