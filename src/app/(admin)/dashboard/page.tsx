import { getSession } from "@/lib/auth/session";
import { PendingSupportUsersCard } from "@/components/dashboard/PendingSupportUsersCard";
import { PendingSacramentsCard } from "@/components/dashboard/PendingSacramentsCard";
import { PendingPersonsCard } from "@/components/dashboard/PendingPersonsCard";
import { UpcomingBirthdaysCard } from "@/components/dashboard/UpcomingBirthdaysCard";
import { ParishInfoCard } from "@/components/dashboard/ParishInfoCard";

export default async function DashboardPage() {
  const user = (await getSession())!;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800">Tableau de bord</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-4">
          <PendingSupportUsersCard />
          <PendingSacramentsCard />
        </div>
        <div className="space-y-4">
          <PendingPersonsCard />
          <UpcomingBirthdaysCard />
        </div>
        <div>
          <ParishInfoCard user={user} />
        </div>
      </div>
    </div>
  );
}
