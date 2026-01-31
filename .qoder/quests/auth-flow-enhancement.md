# Auth Flow Enhancement: Email Verification, Trial Limits & Promo Codes

## Overview

This design describes enhancements to the ADAPT authentication system to support email-based login with verification, trial usage limits for curators and employees, and promo code activation for unlimited access.

**Current State**: The application uses custom Passport.js authentication with email/password stored in PostgreSQL. Users can register and login immediately without email verification.

**Target State**: Add email verification flow, implement trial limits (1 course per curator, max 3 employees per course), and promo code redemption system to unlock unlimited access.

## Business Requirements

### 1. Email Verification Flow

**Goal**: Ensure all registered users have verified email addresses before accessing the system.

**User Flow - Registration**:
- User fills registration form: full name, email, password, role (curator/employee)
- System creates user account with `email_verified = false`
- System sends verification email with unique token link
- User sees "Check Your Email" screen with option to resend verification
- User cannot login until email is verified

**User Flow - Login with Unverified Email**:
- User attempts login with unverified email
- System rejects with error: "Email not verified. Please check your inbox."
- Option to resend verification email displayed

**User Flow - Email Verification**:
- User clicks link in email: `{APP_URL}/auth/verify-email?token={TOKEN}`
- System validates token, marks email as verified
- User redirected to login or dashboard based on session state

**User Flow - Resend Verification**:
- Available on registration success screen and login error screen
- Generates new token, invalidates old one
- Sends new email

### 2. Trial Limits System

**Goal**: Limit unpaid curator accounts to testing the platform with controlled resource usage.

**Curator Trial Limits**:
- Plan: `trial` (default) or `unlimited` (after promo activation)
- Trial curators can create exactly **1 course**
- Each trial course can have maximum **3 employees** enrolled
- Attempting to create 2nd course triggers paywall with promo input option
- Attempting to add 4th employee to course is rejected

**Employee Trial Impact**:
- Employees can join multiple courses (no limit on employee side)
- Limitation is enforced at course level: max 3 unique employees per trial curator's course
- When joining course at capacity, employee sees error: "Course full. Contact curator."

**Promo Code Activation**:
- Curator enters valid promo code tied to their email
- System validates: promo exists, not used, email matches
- Upon success: plan changes to `unlimited`, all limits removed
- Unlimited plan: no course creation limit, no employee limit per course

### 3. User Experience Enhancements

**Onboarding Screens**:

**For Curator (Trial)**:
- Banner: "Test Mode: 1 course available"
- Primary CTA: "Create Course" (disabled if limit reached)
- Paywall card (when limit reached):
  - Message: "Activate promo code to create more courses"
  - Promo code input field + "Activate" button
  - Contact link: "Questions? Contact us on Telegram: @{OWNER_TELEGRAM}"

**For Curator (Unlimited)**:
- No limit banners
- Standard "Create Course" CTA

**For Employee**:
- Simple join flow: "Enter course code" → "Join"
- Error handling for full courses

**Error Messages** (standardized):

| Error Code | Message (Russian) | When Shown |
|------------|------------------|------------|
| `EMAIL_NOT_VERIFIED` | "Email не подтверждён. Проверьте почту." | Login with unverified email |
| `COURSE_LIMIT_REACHED` | "Доступна только 1 тестовая генерация курса. Введите промокод или свяжитесь с владельцем." | Trial curator creates 2nd course |
| `EMPLOYEE_LIMIT_REACHED` | "К этому курсу уже подключено максимальное число сотрудников. Обратитесь к куратору." | 4th employee tries to join trial course |
| `PROMO_NOT_FOUND` | "Промокод не найден." | Invalid promo code entered |
| `PROMO_ALREADY_USED` | "Промокод уже использован." | Promo code redeemed before |
| `PROMO_EMAIL_MISMATCH` | "Этот промокод предназначен для другого email." | Promo email doesn't match user |

## Data Model Changes

### Extended Users Table

The existing `users` table requires new fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `email_verified` | `boolean` | `false` | Email verification status |
| `email_verification_token` | `text` | `null` | Current verification token (nullable) |
| `email_verification_expires` | `timestamptz` | `null` | Token expiration timestamp |
| `plan` | `text` | `'trial'` | User plan: `trial` or `unlimited` |
| `created_courses_count` | `integer` | `0` | Number of courses created (for curators) |
| `promo_activated_at` | `timestamptz` | `null` | When promo was activated |

**Notes**:
- `email_verification_token` is regenerated on each resend request
- Token expires after 24 hours
- `created_courses_count` incremented atomically on course creation
- Only curators use `plan` and `promo_activated_at` fields

### New Promo Codes Table

Create new table `promo_codes`:

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| `id` | `uuid` | PRIMARY KEY | Unique promo code ID |
| `code` | `text` | UNIQUE NOT NULL | Human-readable promo code (e.g., "ADAPT2026XYZ") |
| `email` | `text` | NOT NULL | Email this promo is assigned to |
| `is_used` | `boolean` | DEFAULT false | Whether promo has been redeemed |
| `used_by` | `integer` | FOREIGN KEY users(id) | User who redeemed (nullable) |
| `used_at` | `timestamptz` | nullable | Redemption timestamp |
| `created_at` | `timestamptz` | DEFAULT now() | Promo creation time |

**Constraints**:
- `code` must be unique across all promos
- `email` is stored as-is (case-insensitive comparison on validation)
- Promo can only be used once (`is_used = true` after redemption)

### Extended Tracks Table

The existing `tracks` table requires:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max_employees` | `integer` | `3` | Max employees for this course (trial default: 3, unlimited: null or large number) |

**Notes**:
- For trial curators: `max_employees = 3`
- For unlimited curators: `max_employees = null` (no limit) or set to high value like 999999

### New Course Members Junction

Create `course_members` table to track enrollments with member role clarity:

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| `id` | `uuid` | PRIMARY KEY | Membership ID |
| `course_id` | `integer` | FK tracks(id) | Course reference |
| `user_id` | `integer` | FK users(id) | User reference |
| `member_role` | `text` | enum: `'employee'`, `'curator'` | Role in this course |
| `joined_at` | `timestamptz` | DEFAULT now() | When user joined |

**Constraints**:
- `UNIQUE(course_id, user_id)` — one membership per user per course
- `member_role` differentiates curator (owner) from employees

**Migration Note**: Existing `enrollments` table can coexist or be migrated to `course_members`. If keeping both, `enrollments` tracks progress, `course_members` tracks membership.

## Row-Level Security (RLS) Policies

**users table**:
- User can `SELECT` and `UPDATE` own row only
- No public `INSERT` (handled by server-side registration logic)

**promo_codes table**:
- No direct user access via SQL
- All operations via backend endpoints or database functions

**tracks table**:
- Curator can `SELECT`, `INSERT`, `UPDATE`, `DELETE` own tracks
- Employee can `SELECT` tracks they are enrolled in (via `course_members`)

**course_members table**:
- User can `SELECT` own memberships
- `INSERT` restricted to server-side logic (via RPC function `join_course`)
- `DELETE` restricted to course owner

## Backend Logic Design

### Authentication Endpoints

#### POST `/api/register`

**Input**:
- `email`: string (validated email format)
- `password`: string (min 8 chars)
- `name`: string
- `role`: `'curator'` | `'employee'`

**Process**:
1. Validate input schema
2. Check email uniqueness
3. Hash password (existing scrypt logic)
4. Generate email verification token (crypto random, 32 bytes hex)
5. Set token expiration (now + 24 hours)
6. Insert user record with `email_verified = false`, `plan = 'trial'`
7. Send verification email via mail service
8. Return user data (exclude sensitive fields: password, token)

**Response**:
- Success 201: `{ user: User, message: "Check your email for verification link" }`
- Error 400: `{ message: "User already exists" }` or validation errors

**Email Template**:
```
Subject: Подтвердите email — ADAPT

Привет, {name}!

Пожалуйста, подтвердите ваш email, перейдя по ссылке:

{APP_URL}/auth/verify-email?token={token}

Ссылка действительна 24 часа.

С уважением,
Команда ADAPT
```

#### GET `/auth/verify-email?token={TOKEN}`

**Process**:
1. Extract token from query params
2. Find user by `email_verification_token`
3. Validate token not expired
4. Update user: `email_verified = true`, clear token fields
5. Redirect to login page with success message

**Response**:
- Success: Redirect to `/auth?verified=true`
- Error: Redirect to `/auth?error=invalid_token`

#### POST `/api/resend-verification`

**Input**:
- `email`: string

**Process**:
1. Find user by email
2. Check if already verified (return success if yes)
3. Generate new token, update expiration
4. Invalidate old token
5. Send verification email

**Response**:
- Success 200: `{ message: "Verification email sent" }`
- Error 404: `{ message: "User not found" }`

#### POST `/api/login`

**Modify existing Passport.js strategy**:

**Process**:
1. Authenticate via Passport (existing logic)
2. **After password validation**: Check `email_verified` field
3. If `email_verified = false`, reject login
4. If verified, establish session

**Response**:
- Success 200: `{ user: User }`
- Error 401: `{ message: "Неверный email или пароль" }`
- Error 403: `{ message: "EMAIL_NOT_VERIFIED", canResend: true }`

### Course Limit Enforcement

#### POST `/api/tracks/generate` (modify existing)

**Add check before course creation**:

**Process**:
1. Authenticate user (existing)
2. Verify user role is `curator`
3. **NEW**: Check user plan and course count:
   - Query `users.plan` and `users.created_courses_count`
   - If `plan = 'trial'` AND `created_courses_count >= 1`:
     - Reject with error code `COURSE_LIMIT_REACHED`
4. Proceed with existing course generation
5. **NEW**: Atomically increment `users.created_courses_count`
6. **NEW**: Set `tracks.max_employees = 3` for trial, `null` for unlimited

**Response**:
- Error 403: `{ errorCode: "COURSE_LIMIT_REACHED", message: "..." }`

**Implementation Note**: Use database transaction to ensure atomic count increment.

### Employee Limit Enforcement

#### POST `/api/tracks/join` (modify existing)

**Replace simple enrollment logic with limit check**:

**Process**:
1. Authenticate user
2. Validate join code, fetch course
3. Check existing membership (avoid duplicates)
4. **NEW**: Count current employees in this course:
   - Query `course_members` where `course_id = X` AND `member_role = 'employee'`
5. **NEW**: Fetch course `max_employees` from `tracks` table
6. **NEW**: If `max_employees` is not null AND count >= max_employees:
   - Reject with error code `EMPLOYEE_LIMIT_REACHED`
7. Insert into `course_members` with `member_role = 'employee'`
8. Create enrollment in `enrollments` table (existing progress tracking)

**Response**:
- Error 403: `{ errorCode: "EMPLOYEE_LIMIT_REACHED", message: "..." }`

**Concurrency Protection**: Use PostgreSQL function with row-level lock to prevent race condition where 2 employees join simultaneously and both get accepted despite limit.

**Suggested Database Function**:

Function signature: `join_course(p_course_id INT, p_user_id INT) RETURNS BOOLEAN`

Function logic (pseudocode):
1. Begin transaction
2. Lock course row: `SELECT * FROM tracks WHERE id = p_course_id FOR UPDATE`
3. Count employees: `SELECT COUNT(*) FROM course_members WHERE course_id = p_course_id AND member_role = 'employee'`
4. Check max_employees limit
5. If under limit: insert into course_members, return true
6. Else: rollback, return false
7. Commit transaction

### Promo Code Redemption

#### POST `/api/promo/redeem`

**Input**:
- `code`: string (promo code entered by user)

**Process**:
1. Authenticate user (must be curator)
2. Trim and uppercase code for comparison
3. Query `promo_codes` by code
4. Validate promo exists: if not, return `PROMO_NOT_FOUND`
5. Validate not used: if `is_used = true`, return `PROMO_ALREADY_USED`
6. Validate email match: compare `promo_codes.email` with `auth.user.email` (case-insensitive)
   - If mismatch: return `PROMO_EMAIL_MISMATCH`
7. Begin transaction:
   - Update `promo_codes`: set `is_used = true`, `used_by = user.id`, `used_at = now()`
   - Update `users`: set `plan = 'unlimited'`, `promo_activated_at = now()`
8. Commit transaction
9. Return success

**Response**:
- Success 200: `{ message: "Promo activated", plan: "unlimited" }`
- Error 400: `{ errorCode: "PROMO_NOT_FOUND" | "PROMO_ALREADY_USED" | "PROMO_EMAIL_MISMATCH", message: "..." }`

**Security**: Rate limit this endpoint (e.g., 5 attempts per minute per user) to prevent brute force.

#### Admin: Manual Promo Creation

**Not a user-facing endpoint — admin uses database INSERT**:

SQL example:
```
INSERT INTO promo_codes (id, code, email)
VALUES (gen_random_uuid(), 'ADAPT2026ALPHA', 'curator@example.com');
```

**Promo Code Format**: Recommendation: `ADAPT{YEAR}{RANDOMSTRING}`, e.g., "ADAPT2026XKZY7"

## UI/UX Flow Design

### Registration Flow

**Screen 1: Registration Form** (`/auth?mode=register`)

Form fields:
- Full Name (text input)
- Email (email input)
- Password (password input, min 8 chars)
- Role selector (radio buttons: Employee / Curator)
- Submit button: "Create Account"

On submit:
- Call `POST /api/register`
- On success: navigate to "Verify Email" screen
- On error: display inline error message

**Screen 2: Verify Email** (`/auth/verify-email-prompt`)

Content:
- Heading: "Check Your Email"
- Message: "We sent a verification link to {email}. Please check your inbox and click the link."
- Primary button: "Resend Email" (calls `POST /api/resend-verification`)
- Secondary link: "Change Email" (returns to registration)

**Screen 3: Email Verified** (`/auth?verified=true`)

Content:
- Success message: "Email verified! You can now log in."
- Auto-redirect to login form after 2 seconds

### Login Flow

**Screen: Login Form** (`/auth?mode=login`)

Form fields:
- Email
- Password
- Submit button: "Login"

Error handling:
- If `EMAIL_NOT_VERIFIED` error returned:
  - Display error: "Email not verified. Please check your inbox."
  - Show button: "Resend Verification Email"
  - On resend click: call `POST /api/resend-verification` with user's email

### Curator Onboarding (Trial)

**Dashboard Initial View** (`/curator/dashboard`)

Display:
- **Trial Banner** (visible if `plan = 'trial'`):
  - Text: "🎯 Test Mode: 1 course available"
  - Subtext: "Activate promo code for unlimited access"

- **Create Course Section**:
  - Button: "Create Course" (enabled if `created_courses_count = 0`)
  - If `created_courses_count >= 1`:
    - Button disabled
    - Show **Paywall Card**

**Paywall Card** (displayed when course limit reached):

Content:
- Heading: "Unlock More Courses"
- Message: "You've used your test course. Activate a promo code to create unlimited courses."
- Promo input field: Text input, placeholder "Enter promo code"
- Button: "Activate"
- Help text: "Don't have a code? Contact us on Telegram: @{OWNER_TELEGRAM}"

On activate:
- Call `POST /api/promo/redeem` with entered code
- On success: refresh page, banner disappears, button enabled
- On error: display error message below input

### Employee Join Flow

**Join Course Screen** (`/app/join`)

Form:
- Course code input (text, 6-digit code)
- Button: "Join Course"

Error handling:
- If `EMPLOYEE_LIMIT_REACHED`:
  - Display error: "This course is full. Please contact the curator for access."

## Configuration & Environment Variables

Add to `.env`:

| Variable | Example | Description |
|----------|---------|-------------|
| `APP_URL` | `http://localhost:3000` | Base URL for email links |
| `OWNER_TELEGRAM` | `@adapt_owner` | Telegram handle for support |
| `SMTP_HOST` | `smtp.gmail.com` | Email service host |
| `SMTP_PORT` | `587` | Email service port |
| `SMTP_USER` | `noreply@adapt.com` | Email sender address |
| `SMTP_PASSWORD` | `***` | Email service password |
| `SMTP_FROM` | `ADAPT <noreply@adapt.com>` | Email "From" field |

**Existing Variables** (no changes):
- `DATABASE_URL` — PostgreSQL connection
- `SESSION_SECRET` — Session encryption
- `SUPABASE_*` — Keep as-is (already working)
- `YANDEX_*` — Keep as-is (AI assistant, already working)

## Migration Plan

### Migration 0002: Auth Enhancements

**File**: `migrations/0002_auth_enhancements.sql`

**Operations**:

1. Extend `users` table:
   - Add `email_verified BOOLEAN DEFAULT false`
   - Add `email_verification_token TEXT`
   - Add `email_verification_expires TIMESTAMPTZ`
   - Add `plan TEXT DEFAULT 'trial' CHECK (plan IN ('trial', 'unlimited'))`
   - Add `created_courses_count INTEGER DEFAULT 0`
   - Add `promo_activated_at TIMESTAMPTZ`

2. Create `promo_codes` table (structure as per Data Model section)

3. Add index: `CREATE INDEX idx_users_verification_token ON users(email_verification_token)`

4. Add index: `CREATE INDEX idx_promo_codes_code ON promo_codes(code)`

**Backfill**:
- Set `email_verified = true` for all existing users (grandfather existing accounts)
- Set `plan = 'trial'` for all existing curators

### Migration 0003: Course Limits

**File**: `migrations/0003_course_limits.sql`

**Operations**:

1. Extend `tracks` table:
   - Add `max_employees INTEGER DEFAULT 3`

2. Create `course_members` table (structure as per Data Model section)

3. Create database function `join_course(p_course_id INT, p_user_id INT)`

**Backfill**:
- Insert curator memberships: for each track, insert owner as `member_role = 'curator'`
- Insert employee memberships: for each enrollment, insert as `member_role = 'employee'`

## Testing Strategy

### Unit Tests (Backend)

Test files: `server/auth.test.ts`, `server/limits.test.ts`

**Auth Tests**:
1. Registration creates unverified user
2. Login with unverified email is rejected
3. Email verification token validates and marks user verified
4. Token expiration prevents verification after 24h
5. Resend verification generates new token

**Limits Tests**:
1. Trial curator can create 1 course, 2nd creation blocked
2. Trial course accepts 3 employees, 4th join blocked
3. Promo redemption with valid code upgrades plan to unlimited
4. Promo redemption with wrong email is rejected
5. Used promo code cannot be redeemed again

### Integration Tests

Test file: `test/smoke-limits.ts`

**Scenario 1: Trial Curator Limit**:
1. Register curator (trial plan)
2. Create course 1 → success
3. Attempt create course 2 → error `COURSE_LIMIT_REACHED`

**Scenario 2: Employee Limit**:
1. Create trial curator with 1 course
2. Enroll employee 1, 2, 3 → success
3. Attempt enroll employee 4 → error `EMPLOYEE_LIMIT_REACHED`

**Scenario 3: Promo Activation**:
1. Create promo code for curator email
2. Curator redeems promo → plan = unlimited
3. Curator creates course 2 → success (no limit)

### Manual Testing Checklist

1. Register new user → receive email → click link → verify success
2. Login with unverified email → see error + resend option
3. Trial curator: create 1st course → success, 2nd course → paywall
4. Trial curator: enter valid promo → unlimited plan → create 2nd course
5. Employee: join course with 3 employees → success, join full course → error
6. Edge case: concurrent employee joins don't exceed limit

## Rollout Plan

**Phase 1: Backend + Migration** (No User Impact)
1. Deploy migrations 0002 and 0003
2. Deploy backend changes (email verification, limit checks, promo endpoints)
3. Existing users grandfather verified (backfill)
4. Test in production with internal accounts

**Phase 2: Frontend + Email Service**
1. Deploy UI changes (verify email screen, paywall card, error messages)
2. Configure SMTP service
3. Enable email sending
4. Monitor email delivery rates

**Phase 3: Promo Code Distribution**
1. Generate promo codes for beta users
2. Send promo codes to curator beta list
3. Monitor promo redemption and usage

## Open Questions & Decisions

**Q1**: Should employees have any plan limits?
**Decision**: No. Employees are not creators, limit enforcement is at course level only.

**Q2**: What happens to existing courses when curator activates promo?
**Decision**: Existing courses remain as-is. New courses can be created without limit. Existing courses keep `max_employees = 3` unless curator manually updates.

**Q3**: Should promo codes have expiration dates?
**Decision**: Not in v1. Can add `expires_at` field in future if needed.

**Q4**: How to handle user who loses email access and can't verify?
**Decision**: Admin support flow: admin can manually set `email_verified = true` via database update. No self-service recovery in v1.

**Q5**: Should we migrate from Passport.js to Supabase Auth entirely?
**Decision**: No. Requirement explicitly states to NOT change existing auth integration. Supabase is used only for database, not auth.

## Success Metrics

**Email Verification**:
- 95%+ of new registrations complete email verification within 24h
- < 5% support requests related to verification issues

**Trial Limits**:
- 100% enforcement: no trial curator can create > 1 course
- 100% enforcement: no trial course can exceed 3 employees

**Promo Conversion**:
- Track promo redemption rate among trial curators
- Measure course creation rate pre/post promo activation

## Technical Constraints

**MUST NOT**:
- Change Yandex AI assistant integration
- Change Supabase database connection method
- Disable RLS policies for convenience
- Migrate to different auth provider

**MUST**:
- Keep all changes backward compatible with existing data
- Use SQL migrations for all schema changes
- Implement server-side validation for all limits
- Handle concurrency in employee joins (use database locks)

## Appendix: Email Service Integration

**Recommended Library**: `nodemailer` (already common in Node.js ecosystem)

**Service Setup** (example with Gmail):

Configuration object:
- host: `smtp.gmail.com`
- port: `587`
- secure: `false`
- auth: { user, pass }

**Alternative Services**:
- SendGrid (API-based, better deliverability)
- AWS SES (if already using AWS)
- Mailgun

**Email Sending Function** (server/email.ts):

Function signature: `sendVerificationEmail(to: string, token: string, name: string)`

Function behavior:
- Construct email body with token link
- Call mailer transport
- Log email send success/failure
- Handle errors gracefully (don't block registration on email failure)

**Error Handling**: If email send fails, still create user. User can request resend later.
