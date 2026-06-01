import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  Gift,
  MessageSquare,
  Send,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { ROLE, type Role } from "@/lib/constants";

export interface NavigationItemDefinition {
  label: string;
  href: string;
  icon: typeof BarChart3;
}

export const baseNavigationItems: NavigationItemDefinition[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    label: "Messages",
    href: "/dashboard/chat",
    icon: MessageSquare,
  },
];

export const roleNavigationItems: Record<Role, NavigationItemDefinition[]> = {
  [ROLE.HR]: [
    { label: "Equipes", href: "/dashboard/equipe", icon: Users },
    { label: "Historique des demandes", href: "/dashboard/requests", icon: FileText },
    { label: "Approbations en attente", href: "/dashboard/approvals", icon: CheckCircle2 },
    { label: "Utilisateurs", href: "/dashboard/users", icon: Users },
    { label: "Competences", href: "/dashboard/skills", icon: Sparkles },
    { label: "Projets", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Journal d'audit", href: "/dashboard/audit", icon: ClipboardList },
  ],
  [ROLE.MANAGER]: [
    { label: "Mon Equipe", href: "/dashboard/equipe", icon: Users },
    { label: "Demandes de l'equipe", href: "/dashboard/team-requests", icon: FileText },
    { label: "Mes approbations", href: "/dashboard/my-approvals", icon: CheckCircle2 },
    { label: "Projets", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Competences", href: "/dashboard/skills", icon: Sparkles },
  ],
  [ROLE.EMPLOYEE]: [
    { label: "Mes demandes", href: "/dashboard/my-requests", icon: FileText },
    { label: "Nouvelle demande", href: "/dashboard/new-request", icon: Send },
    { label: "Projets", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Historique des bonus", href: "/dashboard/bonuses", icon: Gift },
    { label: "Competences", href: "/dashboard/skills", icon: Sparkles },
  ],
};

export const settingsNavigationItem: NavigationItemDefinition = {
  label: "Parametres",
  href: "/dashboard/settings",
  icon: Settings,
};
