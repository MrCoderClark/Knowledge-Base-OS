import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookOpen,
  FileText,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  Search,
  Settings,
  Shield,
  Users,
  UsersRound,
  Video,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/** Primary sidebar navigation (matches docs/Dashboard.png). */
export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Videos", href: "/videos", icon: Video },
  { label: "Categories", href: "/categories", icon: FolderTree },
  { label: "Training", href: "/courses", icon: GraduationCap },
  { label: "Search", href: "/search", icon: Search },
  { label: "Users", href: "/users", icon: Users },
  { label: "Teams", href: "/teams", icon: UsersRound },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Activity", href: "/activity", icon: Activity },
];

/** Footer navigation. */
export const footerNav: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Permissions", href: "/permissions", icon: Shield },
];
