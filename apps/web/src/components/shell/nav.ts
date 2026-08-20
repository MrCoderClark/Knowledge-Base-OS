import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookMarked,
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

import type { Permission } from "@/server/authz/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When set, the item is only shown to users who hold this permission. */
  permission?: Permission;
};

/** Primary sidebar navigation (matches docs/Dashboard.png). */
export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Videos", href: "/videos", icon: Video },
  { label: "Categories", href: "/categories", icon: FolderTree, permission: "category:manage" },
  { label: "Training", href: "/courses", icon: GraduationCap },
  { label: "My Learning", href: "/my-learning", icon: BookMarked },
  { label: "Search", href: "/search", icon: Search },
  { label: "Users", href: "/users", icon: Users, permission: "member:manage" },
  { label: "Teams", href: "/teams", icon: UsersRound, permission: "team:manage" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics:read" },
  { label: "Activity", href: "/activity", icon: Activity, permission: "activity:read" },
];

/** Footer navigation. */
export const footerNav: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings, permission: "settings:manage" },
  { label: "Permissions", href: "/permissions", icon: Shield, permission: "permissions:manage" },
];
