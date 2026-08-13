You are a senior application security engineer, principal Next.js architect, and backend engineer.

I need you to design and implement a **production-grade, enterprise-quality authentication and authorization system** for my existing Next.js web application.

Do NOT treat this as a tutorial or demo implementation. Treat it as software that will eventually handle real users, sensitive account data, security-critical sessions, and potentially enterprise customers.

## 1. FIRST: INSPECT THE EXISTING APPLICATION

Before writing code:

1. Inspect the entire repository structure.
2. Identify:

   * Next.js version
   * React version
   * TypeScript configuration
   * App Router vs Pages Router
   * Existing database
   * ORM/query layer
   * Existing API routes/server actions
   * Existing middleware
   * Existing environment variables
   * Existing UI/component system
   * Existing testing framework
   * Existing logging
   * Existing email infrastructure
   * Existing Redis/cache infrastructure
   * Existing security libraries
3. Understand the current architecture and conventions.
4. Do not introduce duplicate dependencies or competing architectural patterns.
5. Do not replace existing infrastructure unless there is a strong technical reason.
6. Before making major architectural changes, explain what you found and what you recommend.

If the repository already contains authentication code, audit it first. Identify vulnerabilities and migration requirements before replacing anything.

---

# 2. ARCHITECTURAL GOAL

Build authentication using:

* Next.js
* TypeScript
* PostgreSQL
* The repository's existing ORM if suitable
* Redis if available/appropriate for rate limiting and ephemeral security state
* Zod or the existing validation framework
* Argon2id for password hashing
* Secure server-side session management
* Secure HttpOnly cookies
* Strong separation between authentication, authorization, and application business logic

Do NOT implement cryptographic primitives yourself.

Do NOT invent custom encryption algorithms.

Do NOT store plaintext passwords.

Do NOT store plaintext password-reset tokens, email-verification tokens, or similar sensitive bearer tokens if a secure hashed-token design can be used.

Prefer mature, actively maintained authentication/security libraries where appropriate. Before introducing an authentication library, evaluate whether it actually fits the existing Next.js architecture and requirements.

---

# 3. SECURITY PRINCIPLES

Follow OWASP guidance and modern security best practices.

Design against:

* Credential stuffing
* Brute-force attacks
* Password spraying
* Session theft
* Session fixation
* Session replay
* CSRF
* XSS
* SQL injection
* Account enumeration
* Token leakage
* Password-reset abuse
* Email-verification abuse
* OAuth account takeover
* Open redirects
* Timing attacks where relevant
* Privilege escalation
* Broken access control
* IDOR
* Replay attacks
* Malicious OAuth redirect manipulation
* Excessive login attempts
* Automated attacks
* Stolen refresh/session credentials
* Compromised devices
* Concurrent-session abuse

Never return sensitive internal errors to users.

Authentication errors should avoid revealing whether an account exists when that information could facilitate account enumeration.

---

# 4. USER ACCOUNT SYSTEM

Design a robust user model.

At minimum consider:

User:

* id
* email
* normalized email
* email verification state
* password hash
* name/profile information
* account status
* createdAt
* updatedAt
* lastLoginAt
* failedLoginAttempts if appropriate
* lockedUntil if appropriate

Session:

* id
* userId
* securely generated session identifier
* createdAt
* expiresAt
* lastSeenAt
* revokedAt
* IP metadata where appropriate
* user-agent/device metadata where appropriate

Also design appropriate models for:

* Email verification
* Password reset
* MFA
* MFA recovery codes
* OAuth/OIDC accounts
* Login attempts
* Security events/audit logs
* Roles
* Permissions
* User-role relationships
* Organization membership if the application is multi-tenant

Do not blindly add fields just because they are listed above. Explain your final schema and why each security-sensitive field exists.

---

# 5. PASSWORD SECURITY

Implement secure password handling.

Requirements:

* Argon2id
* Appropriate memory/time/parallelism parameters
* Password strength policy based on modern security guidance
* Do not impose arbitrary complexity rules such as "one uppercase + one symbol" unless there is a specific business requirement
* Check passwords against common/breached-password data if infrastructure allows
* Never log passwords
* Never return password hashes to clients
* Never expose password hashes through APIs
* Constant-time/safe comparison where applicable
* Password change must invalidate or appropriately rotate existing sessions
* Consider notifying the user of important security events

Create a clean password hashing abstraction so the implementation can be changed later without rewriting authentication logic.

---

# 6. SESSION MANAGEMENT

Implement secure session management.

Requirements:

* Secure random session identifiers
* HttpOnly cookies
* Secure cookies in production
* Appropriate SameSite policy
* Explicit expiration
* Idle timeout where appropriate
* Absolute session lifetime where appropriate
* Session revocation
* Session rotation after authentication/security-sensitive events
* Protection against session fixation
* Ability for users to view active sessions/devices
* Ability to revoke individual sessions
* Ability to revoke all sessions
* Proper logout
* Server-side session validation
* No sensitive authentication state stored in localStorage

Do not rely solely on a client-side JWT stored in localStorage for authentication.

If JWTs are used anywhere, document precisely why and how they are secured, rotated, revoked, and validated.

---

# 7. LOGIN

Implement a production-grade login flow.

Requirements:

* Email/password authentication
* Generic authentication errors
* Rate limiting
* Brute-force protection
* Suspicious-login detection hooks
* Session creation only after successful authentication
* Proper session rotation
* Optional "remember me" behavior with clearly defined security semantics
* Audit/security event logging

Do not allow attackers to determine whether an email address exists merely by submitting login requests.

---

# 8. REGISTRATION

Implement secure registration.

Requirements:

* Input validation
* Email normalization
* Password validation
* Duplicate-account handling without unnecessary account enumeration
* Email verification
* Rate limiting
* Abuse protection
* Secure initial session behavior
* Audit/security events

Do not automatically treat an unverified email as fully trusted.

---

# 9. EMAIL VERIFICATION

Build a secure email verification flow.

Requirements:

* Cryptographically secure random token
* Store only a secure representation/hash of the token where appropriate
* Short expiration
* One-time use
* Token invalidation after successful verification
* Rate limiting
* Resend functionality
* Generic responses
* Security event logging

Do not put sensitive permanent credentials in URLs.

---

# 10. PASSWORD RESET

Build a secure password-reset system.

Requirements:

* "Forgot password" endpoint
* Generic response regardless of whether the account exists
* Cryptographically secure one-time reset token
* Secure token storage
* Short expiration
* One-time use
* Rate limiting
* Password reset invalidates existing sessions as appropriate
* Security notification after password reset
* No password disclosure
* No token logging

Do not use predictable reset tokens.

---

# 11. MFA

Design the system to support MFA.

Implement TOTP MFA if practical.

Requirements:

* TOTP enrollment
* QR provisioning
* TOTP verification
* MFA challenge during login
* MFA disable flow requiring appropriate re-authentication
* Recovery codes
* Recovery codes stored securely
* One-time use recovery codes
* Regeneration/revocation
* Security event logging

The architecture should allow additional factors to be added later.

Design clear authentication states such as:

UNAUTHENTICATED
PASSWORD_AUTHENTICATED
MFA_REQUIRED
FULLY_AUTHENTICATED

Do not accidentally issue a fully authenticated session before MFA is completed.

---

# 12. REAUTHENTICATION

Implement a mechanism for requiring recent authentication before sensitive operations.

Examples:

* Change password
* Disable MFA
* Change primary email
* View highly sensitive account information
* Delete account
* Change security settings
* Generate API credentials
* Modify organization ownership/admin settings

Define a clear concept of "recent authentication."

---

# 13. OAUTH / OIDC

Design the architecture for OAuth/OIDC providers.

Potential providers:

* Google
* Microsoft
* GitHub
* Apple

But do not add providers that are not required.

Follow OAuth/OIDC best practices:

* Authorization Code flow
* PKCE where applicable
* Strict redirect URI validation
* State validation
* Nonce validation where applicable
* Proper issuer validation
* Proper audience validation
* Token validation
* Secure account linking
* Prevent account takeover through unsafe email-based linking

Do not automatically link OAuth accounts to existing users merely because the provider returns the same email address unless the provider's email verification/trust guarantees justify it.

Document the account-linking security model.

---

# 14. AUTHORIZATION

Authentication and authorization must be separate.

Implement a clean authorization layer.

Support:

* Roles
* Permissions
* Resource-level authorization
* Server-side authorization checks
* Route protection
* API protection
* Server action protection
* UI visibility as a convenience only

Never rely on hiding a button in React as an authorization mechanism.

Every privileged operation must enforce authorization on the server.

Design APIs such as:

hasPermission()
requirePermission()
requireRole()
requireAuthenticatedUser()

or equivalent abstractions consistent with the codebase.

Avoid scattering authorization logic throughout the application.

---

# 15. MULTI-TENANCY / ORGANIZATIONS

If the existing application is intended for organizations/enterprise customers, design the authorization model to support:

* Organizations
* Organization members
* Organization roles
* Organization-level permissions
* Ownership
* Invitations
* Member removal
* Role changes
* Organization isolation

Prevent cross-tenant data access.

Every database query involving tenant-owned resources must have a clear tenant boundary.

If multi-tenancy is not currently required by the application, design extension points without unnecessarily implementing a huge unused system.

---

# 16. RATE LIMITING

Implement rate limiting for security-sensitive operations.

At minimum consider:

* Login
* Registration
* Password reset requests
* Password reset completion
* Email verification
* Resending verification email
* MFA verification
* MFA enrollment
* OAuth initiation/callback
* Account recovery
* Sensitive security operations

Use Redis if already available or if it is the appropriate infrastructure.

Design rate limits so they cannot be trivially bypassed by changing an IP address.

Use a combination of appropriate identifiers where necessary.

Do not create a denial-of-service vector by making rate limiting itself excessively expensive.

---

# 17. SECURITY HEADERS

Audit and implement appropriate security headers.

Consider:

* Content-Security-Policy
* Strict-Transport-Security
* X-Content-Type-Options
* Referrer-Policy
* Permissions-Policy
* Frame protection
* Appropriate cookie attributes

Do not blindly copy a CSP from a blog post.

Inspect the actual application's scripts, resources, analytics, images, fonts, APIs, and third-party integrations and create a CSP compatible with the application.

Document any unavoidable CSP exceptions.

---

# 18. CSRF

Analyze every authentication state-changing operation.

Implement appropriate CSRF protections based on the architecture.

Pay particular attention to:

* Cookie-based authentication
* Server actions
* POST/PUT/PATCH/DELETE APIs
* OAuth callbacks
* Account/security settings
* Logout
* Password changes
* Email changes
* MFA changes

Do not simply state "SameSite cookies solve CSRF." Explain the actual threat model and protections used.

---

# 19. AUDIT / SECURITY EVENTS

Create structured security events.

Examples:

* LOGIN_SUCCESS
* LOGIN_FAILURE
* LOGOUT
* PASSWORD_CHANGED
* PASSWORD_RESET_REQUESTED
* PASSWORD_RESET_COMPLETED
* EMAIL_VERIFIED
* MFA_ENABLED
* MFA_DISABLED
* MFA_FAILURE
* SESSION_CREATED
* SESSION_REVOKED
* ALL_SESSIONS_REVOKED
* OAUTH_ACCOUNT_LINKED
* OAUTH_ACCOUNT_UNLINKED
* ROLE_CHANGED
* ACCOUNT_LOCKED
* ACCOUNT_UNLOCKED
* SUSPICIOUS_LOGIN

Never log:

* Passwords
* Session tokens
* Password reset tokens
* Email verification tokens
* MFA secrets
* Recovery codes
* OAuth access tokens
* OAuth refresh tokens
* Authorization codes

Be careful with IP addresses and user-agent data because they may constitute sensitive personal data depending on jurisdiction and application requirements.

---

# 20. OBSERVABILITY

Authentication failures should be observable without leaking secrets.

Implement structured logging with:

* Event type
* Timestamp
* User ID when known
* Request/correlation ID
* IP metadata where appropriate
* User-agent metadata where appropriate
* Authentication result
* Failure reason category

Avoid putting sensitive credentials or tokens in logs.

Make it possible for production monitoring to detect:

* Credential stuffing
* Unusual login failures
* MFA attacks
* Password-reset abuse
* Large-scale account enumeration
* Suspicious session activity

---

# 21. DATABASE SECURITY

Review all database access.

Requirements:

* Parameterized queries
* ORM protections
* Correct unique constraints
* Correct indexes
* Foreign keys
* Transaction boundaries
* Race-condition handling
* Atomic token consumption
* Atomic security-sensitive state changes

Pay special attention to race conditions such as:

* Consuming the same reset token twice
* Using the same MFA recovery code twice
* Concurrent session revocation
* Concurrent role changes
* Email verification races
* Account creation races

Use database transactions where appropriate.

---

# 22. API DESIGN

Create clean server-side authentication APIs/services.

Separate:

* Authentication
* Session management
* Authorization
* Password management
* MFA
* OAuth
* Security events
* Rate limiting

Do not put the entire authentication system inside one enormous route handler.

Keep security-sensitive logic testable independently from HTTP.

---

# 23. FRONTEND

Build polished authentication UI consistent with the existing application.

Include appropriate pages/components for:

* Login
* Registration
* Email verification
* Forgot password
* Reset password
* MFA challenge
* MFA enrollment
* Recovery codes
* Account security
* Active sessions
* Change password
* Change email
* OAuth login

UX should not undermine security.

Do not reveal whether an account exists when doing so would create account enumeration.

---

# 24. TESTING

This is mandatory.

Create extensive tests.

At minimum:

### Unit tests

Test:

* Password hashing
* Password verification
* Token generation
* Token hashing
* Token expiration
* Session validation
* Authorization
* Permission checks
* Rate limiting
* MFA
* Recovery codes

### Integration tests

Test:

* Registration
* Login
* Logout
* Email verification
* Password reset
* Password change
* Session revocation
* MFA enrollment
* MFA login
* OAuth flow where implemented
* Authorization boundaries

### Security tests

Explicitly test:

* Session fixation
* Expired tokens
* Reused tokens
* Invalid tokens
* Replay attacks
* CSRF
* Account enumeration
* Brute-force attempts
* Rate-limit bypass attempts
* Privilege escalation
* Cross-tenant access
* IDOR
* Unauthorized API access
* Unauthorized server actions
* Concurrent token consumption
* OAuth account-linking vulnerabilities

### End-to-end tests

Create realistic user journeys.

Do not stop when the happy path works.

---

# 25. THREAT MODEL

Before finalizing implementation, produce a concise threat model.

For each major attack:

1. Attack
2. Attack surface
3. Mitigation
4. Remaining risk

Include at least:

* Credential stuffing
* Brute force
* Session theft
* Session fixation
* CSRF
* XSS
* Account enumeration
* Password reset abuse
* OAuth account takeover
* Privilege escalation
* IDOR
* Cross-tenant access
* Token replay
* MFA bypass
* Insider/admin abuse where applicable

---

# 26. ENVIRONMENT / SECRETS

Create a clean environment-variable strategy.

Requirements:

* No secrets committed to Git
* No hardcoded credentials
* Validate required environment variables at startup/build time where appropriate
* Separate development/test/production configuration
* Document every required environment variable
* Provide a safe `.env.example`
* Never expose server-only secrets to the client
* Clearly distinguish `NEXT_PUBLIC_*` variables from server-only secrets

---

# 27. DEPENDENCY POLICY

Before adding dependencies:

1. Check whether the functionality already exists in the project.
2. Prefer mature, actively maintained packages.
3. Avoid unnecessary dependencies.
4. Avoid abandoned authentication/security packages.
5. Explain why each security-critical dependency is being introduced.
6. Check for known security concerns with major dependencies.

Do not build security-critical functionality simply because a dependency would be inconvenient.

---

# 28. PRODUCTION READINESS

The final system must be suitable for deployment behind:

* HTTPS
* Reverse proxy/CDN
* Multiple application instances
* Horizontal scaling
* Serverless environments where applicable

Do not rely on in-memory state for functionality that must work across multiple application instances.

Consider:

* Clock differences
* Database connection pooling
* Redis availability
* Distributed rate limiting
* Session revocation across instances
* Cache invalidation
* Deployment migrations
* Secret rotation
* Key rotation
* Graceful failure of dependencies

---

# 29. MIGRATION / EXISTING USERS

If the existing application already has users or authentication:

Do NOT casually delete or invalidate existing accounts.

First determine:

* Existing password hash format
* Existing sessions
* Existing OAuth identities
* Existing user IDs
* Existing database schema
* Existing authorization rules

Design a migration strategy.

If passwords cannot be migrated securely, design an appropriate forced-reset migration.

Preserve user identity relationships wherever possible.

---

# 30. CODE QUALITY

Follow the existing project's conventions.

Code must be:

* Strongly typed
* Modular
* Testable
* Readable
* Maintainable
* Explicit about security boundaries

Avoid:

* `any`
* giant functions
* giant route handlers
* duplicated authorization checks
* duplicated security logic
* hidden global state
* unnecessary abstractions
* premature microservices
* unnecessary complexity

Clearly label security-critical code.

---

# 31. DOCUMENTATION

Create documentation explaining:

1. Architecture
2. Authentication flow
3. Session lifecycle
4. Password security
5. MFA
6. OAuth/OIDC
7. Authorization
8. Rate limiting
9. Security events
10. Environment variables
11. Database schema
12. Deployment requirements
13. Secret management
14. Key/token rotation
15. Incident response considerations
16. How to add a new OAuth provider
17. How to add a new permission
18. How to add a new authentication factor

Include diagrams where useful.

---

# 32. IMPLEMENTATION PROCESS

Work in phases.

### Phase 1 — Audit

Inspect the repository and produce:

* Current architecture
* Existing authentication implementation
* Existing dependencies
* Database structure
* Security concerns
* Recommended architecture
* Proposed schema
* Proposed authentication flows

DO NOT implement yet.

### Phase 2 — Design

Produce:

* Authentication architecture
* Authorization architecture
* Database schema
* Session model
* Threat model
* API design
* Security controls
* Migration plan

Wait for confirmation if major architectural changes are required.

### Phase 3 — Implementation

Implement incrementally.

After each major component:

* Run type checking
* Run linting
* Run relevant tests
* Review security implications
* Fix issues before proceeding

### Phase 4 — Security Review

Perform an explicit security review of your own implementation.

Assume an attacker has access to the public internet and knows the application architecture.

Look for:

* Authentication bypasses
* Authorization bypasses
* Race conditions
* Token leaks
* Session bugs
* Enumeration
* CSRF
* XSS
* SSRF where relevant
* OAuth flaws
* Rate-limit bypass
* Cross-tenant access
* Privilege escalation

### Phase 5 — Final Verification

Run:

* Typecheck
* Lint
* Unit tests
* Integration tests
* E2E tests
* Security tests
* Database migration validation
* Production build

Fix all meaningful failures.

---

# 33. IMPORTANT RULES

Do NOT:

* Pretend the system is secure without testing it.
* Invent security guarantees.
* Store authentication tokens in localStorage.
* Store plaintext passwords.
* Log credentials or tokens.
* Implement custom cryptography.
* Trust client-side authorization.
* Assume hidden UI elements provide authorization.
* Automatically trust OAuth email matching without analyzing provider guarantees.
* Use in-memory sessions in a horizontally scaled production environment.
* Hardcode secrets.
* Disable security controls merely to make tests pass.
* Suppress security warnings without understanding them.
* Add massive unnecessary enterprise complexity if the existing application does not need it.

When there are multiple valid approaches, compare them and choose the simplest approach that provides strong security and maintainability.

---

# 34. FINAL DELIVERABLE

At the end provide:

1. Architecture summary
2. Authentication flow diagram
3. Authorization model
4. Database schema summary
5. Security controls implemented
6. Dependencies added and why
7. Environment variables
8. API/routes created
9. Tests created
10. Threat model
11. Known limitations
12. Remaining security risks
13. Production deployment checklist
14. Recommended future improvements

Use modern TECH Stack for this.

Most importantly:

**Do not optimize for how much code you can generate. Optimize for security, correctness, maintainability, testability, and operational reliability.**

If you discover a security-sensitive design decision that is ambiguous, STOP and explain the tradeoff before making a potentially dangerous assumption.
