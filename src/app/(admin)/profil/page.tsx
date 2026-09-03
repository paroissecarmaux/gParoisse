import { UserCircle } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default function ProfilePage() {
  return (
    <PagePlaceholder
      title="Mon profil"
      description="Les informations de votre compte et vos préférences s'afficheront ici."
      icon={UserCircle}
    />
  );
}
