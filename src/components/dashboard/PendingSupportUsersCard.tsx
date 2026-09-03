import { UserCog } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { Badge } from "@/components/ui/Badge";

const MOCK_COUNT = 3;

export function PendingSupportUsersCard() {
  return (
    <WidgetCard title="Utilisateurs en attente de support" icon={UserCog}>
      <Badge tone="teal">{MOCK_COUNT} demandes</Badge>
    </WidgetCard>
  );
}
