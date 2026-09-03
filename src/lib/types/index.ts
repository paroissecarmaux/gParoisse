export type UserRole = "admin" | "member" | "public";

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  householdId?: string;
  birthDate?: string;
  validated: boolean;
}

export interface Household {
  id: string;
  name: string;
  address?: string;
  memberIds: string[];
}

export interface Group {
  id: string;
  name: string;
  category: string;
  memberCount: number;
}

export type SacramentType = "Baptême" | "Mariage" | "Confirmation" | "Eucharistie";

export interface PendingSacrament {
  id: string;
  type: SacramentType;
  label: string;
  date: string;
  validated: boolean;
}

export interface UpcomingBirthday {
  id: string;
  fullName: string;
  age: number;
  date: string;
  isToday: boolean;
}
