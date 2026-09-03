import { CalendarDays } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function AgendaPage() {
  return (
    <PagePlaceholder
      title="Agenda"
      description="Le calendrier des célébrations et événements paroissiaux s'affichera ici."
      icon={CalendarDays}
    />
  );
}
