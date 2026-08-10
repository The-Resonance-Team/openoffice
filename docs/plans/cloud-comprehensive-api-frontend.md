# Cloud: Comprehensive API + Frontend Wiring

Plan to achieve full parity between `cloud-web` UI shells and `cloud-api` endpoints, plus docs/changelog rework.

## Phase 1 — Auth Pages

Frontend pages for the full auth flow. API endpoints already exist.

### Frontend routes

| Route | File | Purpose |
|-------|------|---------|
| `/login` | `app/(public)/login/page.tsx` | Email/password login + OAuth buttons |
| `/register` | `app/(public)/register/page.tsx` | Email/password + org name |
| `/forgot-password` | `app/(public)/forgot-password/page.tsx` | Request reset email |
| `/reset-password` | `app/(public)/reset-password/page.tsx` | Consume token, set new password |
| `/verify-email` | `app/(public)/verify-email/page.tsx` | Consume verify token |

### API endpoints needed

None — all exist (`POST /v1/auth/login`, `POST /v1/auth/register`, `POST /v1/auth/forgot-password`, `POST /v1/auth/reset-password`, `POST /v1/auth/verify-email`).

### Frontend changes

- Add `login()`, `register()`, `forgotPassword()`, `resetPassword()`, `verifyEmail()` to `lib/api.ts`
- Add react-query hooks in `lib/use-api.ts`
- OAuth callback: `cloud-api` redirects to `/app` after setting cookies (no frontend callback page)

---

## Phase 2 — Member Management

### API endpoints

| Method | Path | Auth | Roles | DTO | Description |
|--------|------|------|-------|-----|-------------|
| GET | `/v1/members` | Authenticated | — | — | List members in current org |
| PATCH | `/v1/members/:id` | Authenticated | OWNER, ADMIN | `UpdateMemberDto` | Change role (and/or teamId) |
| DELETE | `/v1/members/:id` | Authenticated | OWNER, ADMIN | — | Remove member from org |

### DTOs

- `UpdateMemberDto` — `{ role?: Role }` (class-validator, @IsOptional, @IsEnum)

### Services

- New `MemberService` in `src/auth/services/member.service.ts` (or extend `AuthService` if <450 lines)

### Frontend

- Wire `OrgView` members section: list + role dropdown + remove button
- Add `listMembers()`, `updateMember()`, `removeMember()` to `lib/api.ts`

---

## Phase 3 — Invite Management

### API endpoints

| Method | Path | Auth | Roles | DTO | Description |
|--------|------|------|-------|-----|-------------|
| GET | `/v1/invites` | Authenticated | OWNER, ADMIN | — | List pending invites for current org |
| DELETE | `/v1/invites/:id` | Authenticated | OWNER, ADMIN | — | Cancel invite |
| POST | `/v1/invites/:id/resend` | Authenticated | OWNER, ADMIN | — | Resend invite email |

### Services

- Extend `InviteService` with `list()`, `cancel()`, `resend()`

### Frontend

- Wire `OrgView` invites section: list pending + cancel button + resend button

---

## Phase 4 — Profile Editing

### API endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| PATCH | `/v1/me` | Authenticated | `UpdateProfileDto` | Update name |
| POST | `/v1/me/password` | Authenticated | `ChangePasswordDto` | Change password |

### DTOs

- `UpdateProfileDto` — `{ name: string }` (@IsString, @IsNotEmpty)
- `ChangePasswordDto` — `{ currentPassword: string, newPassword: string }` (both @IsString, @MinLength(8))

### Services

- Extend `AuthService` with `updateProfile()`, `changePassword()`

### Frontend

- Wire `AccountView` profile section: name input + save, password change form

---

## Phase 5 — Session Management

### API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/me/sessions` | Authenticated | List active sessions (current + others) |
| DELETE | `/v1/me/sessions/:id` | Authenticated | Revoke a specific session |
| DELETE | `/v1/me/sessions` | Authenticated | Revoke all other sessions |

### Services

- New `SessionService` in `src/auth/services/session.service.ts`

### Frontend

- Wire `AccountView` sessions section: list + revoke buttons

---

## Phase 6 — Team CRUD

### API endpoints

| Method | Path | Auth | Roles | DTO | Description |
|--------|------|------|-------|-----|-------------|
| POST | `/v1/teams` | Authenticated | OWNER, ADMIN | `CreateTeamDto` | Create team |
| GET | `/v1/teams` | Authenticated | — | — | List teams in current org |
| PATCH | `/v1/teams/:id` | Authenticated | OWNER, ADMIN | `UpdateTeamDto` | Rename team |
| DELETE | `/v1/teams/:id` | Authenticated | OWNER, ADMIN | — | Delete team |
| POST | `/v1/teams/:id/members` | Authenticated | OWNER, ADMIN | `AssignTeamMemberDto` | Assign member to team |
| DELETE | `/v1/teams/:id/members/:memberId` | Authenticated | OWNER, ADMIN | — | Remove member from team |

### DTOs

- `CreateTeamDto` — `{ name: string }` (@IsString, @IsNotEmpty)
- `UpdateTeamDto` — `{ name: string }` (@IsString, @IsNotEmpty)
- `AssignTeamMemberDto` — `{ memberId: string }` (@IsString, @IsNotEmpty)

### Services

- New `TeamService` in `src/auth/services/team.service.ts`

### Frontend

- Wire `OrgView` teams section: list + create modal + rename + delete + assign/remove member

---

## Phase 7 — Org Editing

### API endpoints

| Method | Path | Auth | Roles | DTO | Description |
|--------|------|------|-------|-----|-------------|
| PATCH | `/v1/orgs/:id` | Authenticated | OWNER, ADMIN | `UpdateOrgDto` | Update name and/or slug |

### DTOs

- `UpdateOrgDto` — `{ name?: string, slug?: string }` (both @IsOptional, @IsString)

### Services

- New `OrgService` in `src/auth/services/org.service.ts`

### Frontend

- Wire `OrgView` org info section: name + slug inputs + save
- Document: slug changes invalidate existing invite links (no redirect, per ADR 0031)

---

## Phase 8 — Settings

### 8a. Appearance

**API endpoint:**

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| PATCH | `/v1/me/preferences` | Authenticated | `UpdatePreferencesDto` | Update theme |

**DTO:** `UpdatePreferencesDto` — `{ theme: 'light' | 'dark' | 'system' }` (@IsEnum)

**Schema change:** Add `theme` column to `User` (default `'system'`)

**Frontend:** Wire `SettingsView` appearance section: theme selector

### 8b. Notifications

**API endpoint:**

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| PATCH | `/v1/me/notifications` | Authenticated | `UpdateNotificationsDto` | Update email prefs |

**DTO:** `UpdateNotificationsDto` — `{ inviteEmail: boolean, passwordChangeEmail: boolean, memberJoinEmail: boolean }`

**Schema change:** Add 3 boolean columns to `User` (all default `true`)

**Frontend:** Wire `SettingsView` notifications section: 3 toggles

### 8c. Updates

**API endpoint:**

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| PATCH | `/v1/me/updates` | Authenticated | `UpdateUpdatesDto` | Update wantsUpdates |

**DTO:** `UpdateUpdatesDto` — `{ wantsUpdates: boolean }`

**Schema change:** Add `wantsUpdates` boolean to `User` (default `true`)

**Frontend:** Wire `SettingsView` updates section: toggle

### 8d. Two-Factor Authentication (TOTP)

**API endpoints:**

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| POST | `/v1/me/2fa/setup` | Authenticated | — | Generate TOTP secret + QR URI |
| POST | `/v1/me/2fa/verify` | Authenticated | `VerifyTotpDto` | Verify code, enable 2FA, return recovery codes |
| POST | `/v1/me/2fa/disable` | Authenticated | `DisableTotpDto` | Disable 2FA (requires password) |
| POST | `/v1/me/2fa/recovery-codes` | Authenticated | — | Regenerate recovery codes |

**DTOs:**

- `VerifyTotpDto` — `{ code: string }` (@IsString, @Length(6, 6))
- `DisableTotpDto` — `{ password: string }` (@IsString, @MinLength(8))

**Schema change:** Add to `User`: `totpSecret?` (encrypted), `totpEnabledAt?`, `recoveryCodes?` (encrypted JSON array)

**Dependencies:** Add `otpauth` + `qrcode` to `cloud-api`

**Services:** New `TwoFactorService` in `src/auth/services/two-factor.service.ts`

**Frontend:** Wire `SettingsView` 2FA section: setup wizard (QR code + verify), disable, recovery codes

### 8e. Delete Account

**API endpoint:**

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| DELETE | `/v1/me` | Authenticated | `DeleteAccountDto` | Delete user (blocks if sole owner) |

**DTO:** `DeleteAccountDto` — `{ password: string }` (@IsString, @MinLength(8))

**Services:** Extend `AuthService` with `deleteAccount()` — checks org ownership, hard-deletes User + all related data

**Frontend:** Wire `SettingsView` delete account section: password confirmation + delete button

---

## Phase 9 — Docs + Changelog

### Docs as MDX

**File structure:**

```
apps/cloud-web/
└── content/
    └── docs/
        ├── introduction.mdx
        ├── quickstart.mdx
        ├── concepts.mdx
        ├── tasks.mdx
        ├── review.mdx
        ├── download.mdx
        └── legal.mdx
```

**Dependencies:** Add `next-mdx-remote` + `gray-matter` to `cloud-web`

**Frontend changes:**

- Replace `lib/docs.ts` static content with MDX file loader
- `app/(public)/docs/[[...slug]]/page.tsx` reads MDX files, renders with `next-mdx-remote`
- Custom MDX components (callouts, code blocks) in `mdx-components.tsx`

### Changelog from GitHub Releases

**Frontend changes:**

- `app/(public)/changelog/page.tsx` fetches GitHub releases via ISR
- `generateStaticParams` + `revalidate: 3600`
- Plain `fetch` to `GET /repos/{owner}/{repo}/releases` with auth token from env

---

## Implementation Order

1. **Phase 1** (auth pages) — unblocks dead links, fastest win
2. **Phase 4** (profile) — small, self-contained
3. **Phase 2** (members) — core org management
4. **Phase 3** (invites) — extends existing flow
5. **Phase 5** (sessions) — security feature
6. **Phase 6** (teams) — org management
7. **Phase 7** (org editing) — org management
8. **Phase 8** (settings) — largest phase, do 2FA last
9. **Phase 9** (docs + changelog) — content rework, independent

---

## Schema Migration

One Prisma migration adding to `User`:

```prisma
theme              String?   @default("system")
inviteEmail        Boolean   @default(true)
passwordChangeEmail Boolean  @default(true)
memberJoinEmail    Boolean   @default(true)
wantsUpdates       Boolean   @default(true)
totpSecret         String?
totpEnabledAt      DateTime?
recoveryCodes      String?
```

---

## New Dependencies

**cloud-api:**

- `otpauth` — TOTP generation/verification
- `qrcode` — QR code generation for 2FA setup

**cloud-web:**

- `next-mdx-remote` — MDX rendering
- `gray-matter` — MDX frontmatter parsing

---

## No Pagination

Per decision: no pagination yet. All list endpoints return full records. Add cursor-based pagination when an org exceeds 100 members.

---

## Error Response Shape

NestJS default: `{ statusCode: number, message: string | string[], error: string }`. Custom error filters normalize app-level errors to this shape.
