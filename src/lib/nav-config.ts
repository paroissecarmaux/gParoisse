import type { LucideIcon } from "lucide-react";
import {
  Users,
  UserPlus,
  Home,
  Building2,
  UsersRound,
  LayoutList,
  Star,
  Layers,
  Cross,
  HeartHandshake,
  LayoutDashboard,
  CalendarDays,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "personsCount";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: "Personnes",
    items: [
      { label: "Toutes les personnes", href: "/personnes", icon: Users, badgeKey: "personsCount" },
      { label: "Créer une personne", href: "/personnes/nouveau", icon: UserPlus },
      { label: "Tous les foyers", href: "/personnes/foyers", icon: Home },
      { label: "Personnes morales", href: "/personnes/morales", icon: Building2 },
    ],
  },
  {
    title: "Groupes et activités",
    items: [
      { label: "Les groupes", href: "/groupes", icon: UsersRound },
      { label: "Tous les groupes", href: "/groupes/tous", icon: LayoutList },
      { label: "Mes agrégats", href: "/groupes/mes-agregats", icon: Star },
      { label: "Gérer les groupes", href: "/groupes/gerer", icon: Layers },
    ],
  },
  {
    title: "Vie chrétienne",
    items: [
      { label: "Sacrements", href: "/vie-chretienne/sacrements", icon: Cross },
      { label: "Funérailles", href: "/vie-chretienne/funerailles", icon: HeartHandshake },
    ],
  },
];

export const MOBILE_BOTTOM_NAV: NavItem[] = [
  { label: "Accueil", href: "/dashboard", icon: LayoutDashboard },
  { label: "Personnes", href: "/personnes", icon: Users },
  { label: "Sacrements", href: "/vie-chretienne/sacrements", icon: Cross },
  { label: "Groupes", href: "/groupes", icon: UsersRound },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
];
