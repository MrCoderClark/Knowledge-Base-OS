# Spec 03 — Auth & RBAC

Status: Draft · Phase: 1 · Owner: TBD

Auth.js (NextAuth v5) for authentication; a **custom RBAC layer** for authorization.
Multi-tenant model: **Organization → Team → Membership(role) → Permissions.**

## 1. Authentication (Auth.js)

**Credentials-only, admin-provisioned. No self-registration, no OAuth/social login.**

- **Provider:** Auth.js `Credentials` (email + password). `authorize()` looks up the
  user by email and verifies the bcrypt `password_hash`.
- **Session:** **JWT** strategy (required when using the Credentials provider — Auth.js
  cannot persist Credentials sessions in the DB). `session.user` carries `id`, `email`,
  `name`, `image`. No `account`/`session`/`verificationToken` adapter tables.
- **Account creation:** users are created **only by admins** (Phase 0: the `db:seed`
  owner admin; Phase 1: the Users module, `member:invite`/`member:manage` gated). There
  is no public sign-up route — `/signin` only authenticates existing accounts.
- **Passwords:** bcrypt (cost 12) in `src/server/auth/password.ts`. Admin sets/reset
  passwords; (Phase 1) optional invite-token or forced-reset-on-first-login flow.
- **Org context:** a user may belong to multiple orgs. The active `org_id` is resolved
  from the route/selector and validated against the user's memberships on every request.
  Never trust an `org_id` from the client without a membership check.
- **Phase 3:** enterprise SSO/SAML + SCIM provisioning can be added later as an
  additional provider without disturbing the credentials path.

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

## 4. Account & membership lifecycle (admin-managed)

- **Create:** an admin creates the `users` row (name, email) and either sets an initial
  password or issues a one-time set-password link; a `memberships` row is created with
  the chosen org role (default `status = active`).
- **No self-service:** there is no public registration; users cannot create their own
  accounts or change their own role.
- **Suspend/remove:** admin sets `status = suspended` or deletes the membership; a
  suspended/removed user fails authorization on the next request (JWT re-checked against
  membership).
- **Password reset:** admin-initiated reset (Phase 1); optional force-reset-on-first-login.

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
