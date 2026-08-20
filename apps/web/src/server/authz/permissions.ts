import type { OrgRole } from "./index";

/** Fine-grained permission verbs (see docs/specs/03-auth-rbac.md). */
export type Permission =
  | "document:create"
  | "document:read"
  | "document:update"
  | "document:delete"
  | "document:publish"
  | "video:create"
  | "video:read"
  | "video:update"
  | "video:delete"
  | "video:publish"
  | "category:manage"
  | "collection:manage"
  | "course:manage"
  | "team:manage"
  | "member:invite"
  | "member:manage"
  | "analytics:read"
  | "activity:read"
  | "settings:manage"
  | "permissions:manage";

const ALL: Permission[] = [
  "document:create",
  "document:read",
  "document:update",
  "document:delete",
  "document:publish",
  "video:create",
  "video:read",
  "video:update",
  "video:delete",
  "video:publish",
  "category:manage",
  "collection:manage",
  "course:manage",
  "team:manage",
  "member:invite",
  "member:manage",
  "analytics:read",
  "activity:read",
  "settings:manage",
  "permissions:manage",
];

const READS: Permission[] = ["document:read", "video:read", "activity:read"];

const EDITOR: Permission[] = [
  ...READS,
  "document:create",
  "document:update",
  "document:publish",
  "video:create",
  "video:update",
  "video:publish",
  "category:manage",
  "collection:manage",
  "course:manage",
  "analytics:read",
];

const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  owner: new Set(ALL),
  admin: new Set(ALL),
  editor: new Set(EDITOR),
  viewer: new Set(READS),
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Permissions a role holds by default (for the grants UI — shown as inherited). */
export function rolePermissions(role: OrgRole): ReadonlySet<Permission> {
  return ROLE_PERMISSIONS[role];
}

export function isPermission(value: string): value is Permission {
  return (ALL as string[]).includes(value);
}

/** Grouped, human-labeled catalog for the permission-management UI. */
export const PERMISSION_GROUPS: {
  group: string;
  permissions: { key: Permission; label: string }[];
}[] = [
  {
    group: "Documents",
    permissions: [
      { key: "document:create", label: "Create documents" },
      { key: "document:update", label: "Edit documents" },
      { key: "document:delete", label: "Delete documents" },
      { key: "document:publish", label: "Publish documents" },
    ],
  },
  {
    group: "Videos",
    permissions: [
      { key: "video:create", label: "Upload videos" },
      { key: "video:update", label: "Edit videos" },
      { key: "video:delete", label: "Delete videos" },
      { key: "video:publish", label: "Publish videos" },
    ],
  },
  {
    group: "Training & content",
    permissions: [
      { key: "course:manage", label: "Manage courses (Training)" },
      { key: "category:manage", label: "Manage categories" },
      { key: "collection:manage", label: "Manage collections" },
    ],
  },
  {
    group: "Administration",
    permissions: [
      { key: "member:invite", label: "Invite members" },
      { key: "member:manage", label: "Manage members (Users)" },
      { key: "team:manage", label: "Manage teams" },
      { key: "analytics:read", label: "View analytics" },
      { key: "activity:read", label: "View activity" },
      { key: "settings:manage", label: "Manage settings" },
      { key: "permissions:manage", label: "Manage permissions" },
    ],
  },
];
