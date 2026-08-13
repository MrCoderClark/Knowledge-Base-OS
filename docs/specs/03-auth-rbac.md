# Spec 03 — Auth & RBAC

Status: Draft · Phase: 1 · Owner: TBD

Auth.js (NextAuth v5) for authentication; a **custom RBAC layer** for authorization.
Multi-tenant model: **Organization → Team → Membership(role) → Permissions.**

## 1. Authentication (Auth.js)

- **Adapter:** `@auth/drizzle-adapter` against the `users`/`accounts`/`sessions` tables.
- **Providers (launch):** Email/OAuth — recommend Google + Microsoft Entra (enterprise
  audience) plus optional credentials for dev. Final provider list is an open decision
  in `PLAN.md`.
- **Session:** database sessions; `session.user` carries `id`, `email`, `name`,
  `avatarUrl`.
- **Org context:** a user may belong to multiple orgs. The active `org_id` is resolved
  from the route/subdomain/selector and validated against the user's memberships on
  every request. Never trust an `org_id` from the client without a membership check.
- **Phase 3:** SSO/SAML + SCIM provisioning slot in at the provider layer.

## 2. Authorization model

Two role scopes:

- **Org role** (`memberships.role`): `owner | admin | editor | viewer` — the primary
  driver of permissions.
- **Team role** (`team_members.role`): `lead | member` — scopes actions to content
  owned by / shared with that team.

### Permission catalog

Permissions are fine-grained verbs on resources; roles are bundles of permissions.
Checked in the **service layer**, not only the UI.

```
document:create  document:read  document:update  document:delete  document:publish
video:create     video:read     video:update     video:delete     video:publish
category:manage  collection:manage
team:manage      member:invite  member:manage
analytics:read   activity:read
settings:manage  permissions:manage
```

### Role → permission matrix (org role)

| Permission | owner | admin | editor | viewer |
|---|:--:|:--:|:--:|:--:|
| *:read (documents, videos, collections, activity) | ✓ | ✓ | ✓ | ✓ |
| document/video:create·update·publish | ✓ | ✓ | ✓ | |
| document/video:delete | ✓ | ✓ | | |
| category:manage, collection:manage | ✓ | ✓ | ✓ | |
| member:invite | ✓ | ✓ | | |
| team:manage, member:manage | ✓ | ✓ | | |
| analytics:read | ✓ | ✓ | ✓ | |
| settings:manage, permissions:manage | ✓ | ✓ | | |
| transfer/delete org | ✓ | | | |

`viewer` = read-only. `editor` = author/curate content, no people/settings. `admin` =
everything except destructive org-level actions. `owner` = all.

## 3. Enforcement

Single choke point in `src/server/rbac`:

```ts
// pseudo-signature
type Actor = { userId: string; orgId: string; orgRole: Role; teamIds: string[] };

async function requirePermission(
  actor: Actor,
  permission: Permission,
  resource?: { ownerTeamId?: string; visibility?: Visibility }
): Promise<void>; // throws ForbiddenError if denied
```

Rules:
1. **Resolve actor** from session + active org membership on every request (RSC loader,
   route handler, or server action).
2. **Deny by default.** No permission → 403. No membership in the org → 404 (don't leak
   existence).
3. **Row scoping.** Reads/writes always filter by `org_id`; team/private visibility
   further restricts to the actor's teams.
4. **UI mirrors, never replaces, server checks.** Hidden buttons are UX; the server is
   the boundary.
5. **Audit.** Every mutation writes an `activity_events` row.

## 4. Invitations & membership lifecycle

- Invite by email → `memberships` row `status = invited` + tokened email link.
- Accept → links/creates the `users` row, flips to `active`.
- Suspend/remove → `status = suspended` / row delete; sessions re-validated against
  membership on next request.

## 5. Permissions UI (design's "Permissions" page)

- Manage members: assign org role, add to teams, set team role.
- Read-only view of the role→permission matrix above.
- (Phase 3) custom roles = editable permission bundles; the catalog already supports it.

## Acceptance criteria

- [ ] Unauthenticated access to any app route redirects to sign-in.
- [ ] A `viewer` cannot create/update/delete/publish via API even by direct call.
- [ ] Cross-org access is impossible: requesting another org's resource → 404.
- [ ] `requirePermission` is invoked in every mutating service; unit tests cover the
      matrix.
- [ ] Every mutation produces an `activity_events` record with the correct actor/verb.
