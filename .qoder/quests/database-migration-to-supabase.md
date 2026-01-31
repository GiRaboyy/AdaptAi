# Database Migration to Supabase

## Overview

Migrate the ADAPT application database from its current hosting to Supabase Postgres. The application already uses Drizzle ORM with PostgreSQL through node-postgres driver. This migration involves generating and applying Drizzle migrations to a Supabase Postgres instance, then switching the application's database connection.

**Scope**: Database migration only. No AI integration changes, no GigaChat, no Salute integrations in this phase.

**Complexity**: Low-Medium (existing Postgres-compatible setup, straightforward migration path)

## Current State Audit

### Database Infrastructure
| Component | Current State | Location |
|-----------|--------------|----------|
| Database Driver | node-postgres (pg) | server/db.ts |
| ORM | Drizzle ORM v0.39.3 | package.json |
| Schema Definition | Complete Drizzle schema with 7 tables | shared/schema.ts |
| Connection Config | DATABASE_URL environment variable | server/db.ts, drizzle.config.ts |
| SSL Support | Configured (production mode) | server/db.ts line 15 |
| Session Store | connect-pg-simple (Postgres-backed) | server/storage.ts line 55-58 |
| Migration Tool | drizzle-kit v0.31.8 | package.json |
| Migration Scripts | Defined but folder not created | package.json lines 11-14 |
| Migration Folder | Not yet created | ./migrations (configured in drizzle.config.ts) |

### Schema Tables
The application defines the following tables in `shared/schema.ts`:

1. **users**: Authentication and user profiles (id, email, password, role, name, avatarUrl, preferVoice)
2. **tracks**: Training courses (id, curatorId, title, description, rawKnowledgeBase, joinCode, strictMode, createdAt)
3. **steps**: Course content steps (id, trackId, type, tag, content, orderIndex)
4. **enrollments**: User course enrollments (id, userId, trackId, progressPct, isCompleted, lastStepIndex, needsRepeatTags, updatedAt)
5. **drill_attempts**: User attempt records (id, userId, stepId, trackId, tag, attemptType, isCorrect, userAnswer, correctAnswer, errorReason, score, timestamp)
6. **conversations**: AI chat conversations (id, title, createdAt)
7. **messages**: AI chat messages (id, conversationId, role, content, createdAt)

### Key Constraints
- `users.email`: UNIQUE, NOT NULL
- `tracks.joinCode`: UNIQUE, NOT NULL
- Foreign key relationships defined via Drizzle relations (not enforced at DB level by default)
- Array column: `enrollments.needsRepeatTags` (text[])
- JSONB column: `steps.content`

### Dependencies Found
No Replit DB or legacy key-value storage dependencies detected. The application is already fully PostgreSQL-based.

### Files Requiring Changes
| File Path | Change Type | Reason |
|-----------|------------|---------|
| .env.example | Update | Add Supabase connection string template |
| README.md or docs/ | Create/Update | Document migration process and setup |
| drizzle.config.ts | Verify | Ensure correct migration output path |
| server/db.ts | Verify | Confirm SSL configuration works with Supabase |

No code changes required in application logic since the app already uses Drizzle with Postgres.

## Migration Architecture

### Connection Flow

```mermaid
graph LR
    A[Application Server] -->|DATABASE_URL| B[Connection Pool]
    B -->|SSL Required| C[Supabase Postgres]
    C --> D[Database: postgres]
    D --> E[Schema: public]
    E --> F[Tables: users, tracks, etc.]
    
    G[Drizzle Kit] -->|Migrations| C
    H[Session Store] -->|connect-pg-simple| C
```

### Migration Process Flow

```mermaid
flowchart TD
    A[Start] --> B[Provision Supabase Project]
    B --> C[Obtain Connection String]
    C --> D[Set DATABASE_URL in .env]
    D --> E[Generate Drizzle Migrations]
    E --> F{Migrations Generated?}
    F -->|No| G[Review Schema Errors]
    G --> E
    F -->|Yes| H[Review Migration SQL Files]
    H --> I[Apply Migrations to Supabase]
    I --> J{Migration Success?}
    J -->|No| K[Rollback and Fix]
    K --> I
    J -->|Yes| L[Verify Tables in Supabase]
    L --> M[Run Application]
    M --> N[Execute QA Checklist]
    N --> O{All Tests Pass?}
    O -->|No| P[Debug and Fix]
    P --> M
    O -->|Yes| Q[Migration Complete]
```

## Phase 1: Supabase Setup

### Supabase Project Provisioning

**Objective**: Create and configure a Supabase Postgres instance.

**Steps**:
1. Create a new Supabase project or use existing project
2. Navigate to Project Settings → Database
3. Locate Connection String (URI format with pooler enabled)
4. Note down the following information:
   - Project Reference ID
   - Database Password
   - Full connection string

**Connection String Format**:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require
```

**Supabase Configuration Checklist**:
- [ ] Project created
- [ ] Password secured
- [ ] Connection string obtained
- [ ] Connection pooler enabled (for better performance)
- [ ] SSL mode set to require

### Environment Configuration

**Update `.env.example`**:

Current state already includes Supabase-compatible template. Verify it contains:

```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?sslmode=require
SESSION_SECRET=your-random-secret-here-change-in-production
```

**Create Local `.env`**:
- Copy `.env.example` to `.env`
- Replace placeholders with actual Supabase credentials
- Ensure `.env` is in `.gitignore` (already configured)
- Generate strong SESSION_SECRET if not done

**Security Notes**:
- Never commit `.env` file with real credentials
- Rotate DATABASE_URL password if accidentally exposed
- Use Supabase's connection pooler for production
- Consider using Supabase environment variables for deployment

## Phase 2: Database Connection Verification

### Current Database Client Review

The application already uses a Postgres-compatible connection setup in `server/db.ts`:

**Connection Pool Configuration**:
- Uses node-postgres Pool
- SSL enabled in production mode
- Throws error if DATABASE_URL not set

**Verification Steps**:
1. Confirm SSL configuration works with Supabase (it should, as Supabase requires SSL)
2. Test connection pool initialization
3. Verify connection pooler compatibility

**Potential Issue**: The current SSL configuration uses `rejectUnauthorized: false` in production. This is acceptable for Supabase but consider enabling strict SSL verification for enhanced security.

**Recommendation**: Update SSL config to be more explicit:

```javascript
ssl: process.env.DATABASE_URL?.includes('supabase.co') 
  ? { rejectUnauthorized: true } 
  : undefined
```

However, this change is optional for initial migration. The current configuration will work with Supabase.

### Session Store Compatibility

The application uses `connect-pg-simple` for session storage, which automatically creates a `session` table in Postgres. This is fully compatible with Supabase Postgres.

**Session Table**: Will be auto-created by connect-pg-simple on first connection
**Storage Location**: Same Supabase database, separate from application tables
**No Action Required**: connect-pg-simple handles table creation automatically

## Phase 3: Drizzle Migration Generation

### Migration Configuration

**Drizzle Config Location**: `drizzle.config.ts`

Current configuration:
- Output directory: `./migrations`
- Schema path: `./shared/schema.ts`
- Dialect: postgresql
- Credentials: DATABASE_URL from environment

**Verification**:
- Ensure DATABASE_URL points to Supabase before generating migrations
- Confirm schema file path is correct
- Check that output directory is writable

### Generate Migrations

**Command**: 
```bash
npm run db:generate
```

This executes `drizzle-kit generate` which:
1. Reads the schema from `shared/schema.ts`
2. Compares against current database state (empty for first run)
3. Generates SQL migration files in `./migrations` folder
4. Creates migration metadata

**Expected Output**:
- `./migrations` folder created
- Migration files with timestamps (e.g., `0000_initial_schema.sql`)
- Meta files for Drizzle tracking

**Generated Migration Contents**:

The migration should include DDL statements for:

**Table Creation**:
1. users table with email unique constraint
2. tracks table with join_code unique constraint
3. steps table with trackId foreign key reference
4. enrollments table with userId and trackId foreign key references, needs_repeat_tags array column
5. drill_attempts table with foreign key references
6. conversations table
7. messages table with conversationId foreign key reference

**Column Types**:
- Serial for auto-increment IDs
- Text for strings
- Integer for numbers
- Boolean for flags
- Timestamp for dates (with defaultNow)
- JSONB for steps.content
- Text[] array for enrollments.needsRepeatTags

**Constraints**:
- Primary keys on all id columns
- Unique constraints on users.email and tracks.join_code
- NOT NULL constraints as defined in schema

**Review Checklist**:
- [ ] Migration files generated successfully
- [ ] SQL syntax appears valid
- [ ] All 7 tables included
- [ ] Unique constraints present
- [ ] Array and JSONB columns correctly typed
- [ ] No unexpected ALTER or DROP statements

**Troubleshooting**:

| Issue | Cause | Solution |
|-------|-------|----------|
| DATABASE_URL error | Environment variable not set | Set DATABASE_URL in .env before generating |
| Schema parsing error | Syntax issue in schema.ts | Review Drizzle schema syntax |
| Migration folder permission denied | Write permissions missing | Check folder permissions |
| Empty migration | No schema changes detected | Ensure this is first migration generation |

## Phase 4: Migration Application

### Apply Migrations to Supabase

**Command Options**:

Option 1 - Push (for development):
```bash
npm run db:push
```
- Directly synchronizes schema to database
- Does not create migration history
- Useful for rapid iteration

Option 2 - Migrate (recommended for production):
```bash
npm run db:migrate
```
- Applies migrations from `./migrations` folder
- Creates migration history tracking
- Supports rollback scenarios

**Recommended Approach**: Use `db:push` for initial setup, then switch to `db:migrate` for future changes.

### Migration Execution Flow

1. **Pre-Migration Verification**:
   - Confirm DATABASE_URL points to Supabase
   - Ensure Supabase database is accessible
   - Verify no conflicting tables exist (fresh database)

2. **Execute Migration**:
   - Run migration command
   - Monitor console output for errors
   - Watch for constraint violations or type mismatches

3. **Post-Migration Verification**:
   - Check Supabase Dashboard → Table Editor
   - Verify all 7 tables exist
   - Inspect table structures and constraints
   - Confirm JSONB and array columns are correct

**Verification Queries** (run in Supabase SQL Editor):

```sql
-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verify users table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users';

-- Check unique constraints
SELECT conname, contype, conrelid::regclass
FROM pg_constraint
WHERE contype = 'u' AND connamespace = 'public'::regnamespace;

-- Verify array column
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'enrollments' AND column_name = 'needs_repeat_tags';
```

**Expected Results**:
- 7 application tables + 1 session table (created by connect-pg-simple)
- users.email has unique constraint
- tracks.join_code has unique constraint
- enrollments.needs_repeat_tags has data type text[] (array)
- steps.content has data type jsonb

### Migration Rollback Strategy

If migration fails:

**Manual Rollback**:
1. Access Supabase SQL Editor
2. Drop created tables in reverse dependency order:
   ```sql
   DROP TABLE IF EXISTS messages;
   DROP TABLE IF EXISTS conversations;
   DROP TABLE IF EXISTS drill_attempts;
   DROP TABLE IF EXISTS enrollments;
   DROP TABLE IF EXISTS steps;
   DROP TABLE IF EXISTS tracks;
   DROP TABLE IF EXISTS users;
   DROP TABLE IF EXISTS session;
   ```

**Fix and Retry**:
1. Identify root cause from error messages
2. Fix schema issues if needed
3. Regenerate migrations
4. Reapply migrations

## Phase 5: Application Integration

### Database Connection Test

**Objective**: Verify the application can connect to Supabase and perform CRUD operations.

**Test Procedure**:

1. **Start Application**:
   ```bash
   npm run dev
   ```

2. **Monitor Logs**:
   - Watch for connection errors
   - Verify no "DATABASE_URL must be set" errors
   - Check for SSL handshake success

3. **Database Seeding**:
   - Application runs seed script on startup (server/seed.ts)
   - Seeds create default curator and employee users
   - Seeds create demo track with steps
   - Verify seed completion message in logs

4. **Verify Seed Data**:
   Query Supabase to confirm seed data exists:
   ```sql
   SELECT * FROM users;
   SELECT * FROM tracks;
   SELECT * FROM steps;
   ```

Expected seed data:
- curator@adapt.com user
- employee@adapt.com user
- "Customer Empathy 101" track with join code "123456"
- 3 steps (content, quiz, roleplay)

### Core Application Flows

The following flows must be tested end-to-end to ensure database operations work correctly through Drizzle ORM with Supabase.

#### Authentication Flow

**Registration**:
- **Action**: User submits registration form
- **Database Operations**:
  - Check if email exists (query users table)
  - Hash password
  - Insert new user record
  - Create session
- **Expected Behavior**:
  - New user appears in users table
  - User is logged in automatically
- **Error Case**: If email exists, return "Пользователь уже зарегистрирован. Войдите." (not "Вы авторизованы")

**Login**:
- **Action**: User submits login credentials
- **Database Operations**:
  - Query user by email
  - Verify password hash
  - Create session
- **Expected Behavior**:
  - User session created
  - No 404 redirect flash
  - User lands on correct dashboard

**Session Persistence**:
- **Storage**: PostgreSQL via connect-pg-simple
- **Table**: session (auto-created)
- **Verification**: Sessions survive page refresh

**Bug Fixes Required**:
1. Registration error message correction (already implemented in server/auth.ts line 73)
2. Login routing guard to prevent 404 flash (application-level fix, not database)

#### Curator Track Creation Flow

**Create Track with File Upload**:
- **Action**: Curator uploads training files (TXT, MD, or DOCX)
- **Database Operations**:
  1. Extract text from files
  2. Generate join code (random 6-digit string)
  3. Insert track record
  4. Call OpenAI to generate steps
  5. Bulk insert steps
- **Expected Behavior**:
  - Track row created in tracks table
  - Multiple step rows created in steps table
  - Join code is unique
  - Steps ordered by orderIndex
- **Verification Queries**:
  ```sql
  SELECT * FROM tracks WHERE curator_id = [CURATOR_ID];
  SELECT * FROM steps WHERE track_id = [TRACK_ID] ORDER BY order_index;
  ```

**Track Library View**:
- **Action**: Curator views library page
- **Database Operations**:
  - Query tracks by curatorId
  - Count enrollments per track
- **Expected Behavior**:
  - All curator's tracks displayed
  - Employee count shown per track
  - Tracks ordered by creation date

**Track Details View**:
- **Action**: Curator opens track details
- **Database Operations**:
  - Query track by ID
  - Query all steps for track
  - Verify curator ownership
- **Expected Behavior**:
  - Track metadata displayed
  - All steps shown in order
  - Edit capabilities available

#### Employee Enrollment Flow

**Join by Code**:
- **Action**: Employee enters 6-digit join code
- **Database Operations**:
  1. Query track by join_code
  2. Check if enrollment already exists
  3. Create enrollment record if new
- **Expected Behavior**:
  - Enrollment row created in enrollments table
  - Initial progress set to 0%
  - lastStepIndex set to 0
  - User redirected to player page
- **Duplicate Join Handling**:
  - If already enrolled, return existing enrollment
  - No error, redirect to course

**Course List View**:
- **Action**: Employee views "My Courses"
- **Database Operations**:
  - Join enrollments and tracks tables
  - Filter by userId
- **Expected Behavior**:
  - All enrolled courses displayed
  - Progress percentage shown
  - Completion status accurate

#### Progress Tracking Flow

**Step Completion**:
- **Action**: Employee completes a step and advances
- **Database Operations**:
  1. Query enrollment by userId and trackId
  2. Count total steps for track
  3. Calculate progress percentage
  4. Update enrollment: lastStepIndex, progressPct, updatedAt
- **Expected Behavior**:
  - enrollment.last_step_index incremented
  - enrollment.progress_pct updated (stepIndex / totalSteps * 100)
  - enrollment.updated_at timestamp refreshed
- **Edge Cases**:
  - Progress capped at 100%
  - Backward navigation does not decrease progress

**Course Completion**:
- **Action**: Employee completes final step
- **Database Operations**:
  - Update enrollment: isCompleted = true, progressPct = 100
- **Expected Behavior**:
  - enrollment.is_completed set to true
  - Progress shows 100%
  - Completion badge visible

#### Drill Attempts Flow

**Record Attempt**:
- **Action**: Employee answers quiz/open/roleplay question
- **Database Operations**:
  - Insert drill_attempts record with:
    - userId, stepId, trackId
    - attemptType (initial, drill_1, drill_2)
    - isCorrect (from AI evaluation or quiz logic)
    - userAnswer, correctAnswer
    - score (0-10)
    - tag (step tag for analytics)
- **Expected Behavior**:
  - New row in drill_attempts table
  - Timestamp auto-set to now()
  - Attempt linked to user and step

**Needs Repeat Tagging**:
- **Action**: Employee fails a step (score < 6)
- **Database Operations**:
  - Query enrollment
  - Append tag to needsRepeatTags array (if not already present)
  - Update enrollment record
- **Expected Behavior**:
  - Tag added to enrollment.needs_repeat_tags array
  - Drill mode can filter steps by these tags
  - No duplicate tags in array

#### Analytics Flow

**Curator Dashboard Analytics**:
- **Action**: Curator views analytics page
- **Database Operations**:
  - Query all curator's tracks
  - Query enrollments per track
  - Query drill attempts per track
  - Calculate aggregates:
    - Total tracks, total employees
    - Average completion percentage
    - Average accuracy (correct attempts / total attempts)
    - Problem topics (tags with < 80% accuracy)
- **Expected Behavior**:
  - Dashboard displays aggregate statistics
  - Track-level breakdown available
  - Problem topics identified by tag

**Track-Specific Analytics**:
- **Action**: Curator views analytics for one track
- **Database Operations**:
  - Query track details
  - Query enrollments for track
  - Query drill attempts for track
  - Calculate per-employee progress
  - Identify problem tags
- **Expected Behavior**:
  - Employee progress list
  - Accuracy by tag
  - Completion rate

### Error Handling Requirements

**Database Connection Errors**:
- **Scenario**: Supabase unreachable or DATABASE_URL invalid
- **Handling**: Application should fail to start with clear error message
- **User Impact**: None if caught before deployment

**Unique Constraint Violations**:
- **Scenario**: Duplicate email registration or join code collision
- **Handling**: Catch error, return user-friendly message
- **Examples**:
  - Email exists: "Пользователь уже зарегистрирован. Войдите."
  - Join code collision: Regenerate code and retry

**Foreign Key Violations**:
- **Scenario**: Attempting to create enrollment for non-existent track
- **Handling**: Validate track existence before insertion
- **Response**: 404 "Track not found"

**Session Expiry**:
- **Scenario**: User session expires while using app
- **Handling**: Redirect to login page
- **User Experience**: No data loss, graceful redirect

**Network Timeouts**:
- **Scenario**: Slow Supabase response
- **Handling**: Set reasonable timeout on queries
- **Fallback**: Show loading state, retry on user action

### Data Integrity Verification

**After First User Flow**:
Run these queries to verify data integrity:

```sql
-- User created
SELECT id, email, role, name FROM users WHERE email = '[TEST_EMAIL]';

-- Track created
SELECT id, curator_id, title, join_code FROM tracks WHERE curator_id = [CURATOR_ID];

-- Steps linked correctly
SELECT COUNT(*) FROM steps WHERE track_id = [TRACK_ID];

-- Enrollment exists
SELECT * FROM enrollments WHERE user_id = [USER_ID] AND track_id = [TRACK_ID];

-- Progress updated
SELECT last_step_index, progress_pct, updated_at 
FROM enrollments 
WHERE user_id = [USER_ID] AND track_id = [TRACK_ID];

-- Attempts recorded
SELECT COUNT(*) FROM drill_attempts WHERE user_id = [USER_ID] AND track_id = [TRACK_ID];
```

## Phase 6: QA Checklist

Execute the following tests in sequence on a local development environment connected to Supabase:

### Pre-Test Setup
- [ ] Supabase database has migrations applied
- [ ] Application starts without errors
- [ ] DATABASE_URL environment variable set correctly
- [ ] Browser console open for error monitoring
- [ ] Supabase SQL Editor open for verification queries

### Registration and Authentication Tests

| Test Case | Steps | Expected Result | Verification |
|-----------|-------|-----------------|--------------|
| New User Registration | 1. Navigate to auth page<br>2. Enter new email + password + name<br>3. Submit form | User created, auto-logged in, redirected to dashboard | Query: `SELECT * FROM users WHERE email = '[EMAIL]'` |
| Duplicate Registration | 1. Register with same email again | Error message: "Пользователь уже зарегистрирован. Войдите." | No new user row created |
| Login Valid Credentials | 1. Logout<br>2. Login with registered email + password | Successful login, no 404 flash, lands on dashboard | Session created in session table |
| Login Invalid Credentials | 1. Login with wrong password | Error: "Неверный email или пароль" | User not logged in |
| Session Persistence | 1. Login<br>2. Refresh page | User remains logged in | Session retrieved from database |

### Curator Track Creation Tests

| Test Case | Steps | Expected Result | Verification |
|-----------|-------|-----------------|--------------|
| Create Track (File Upload) | 1. Login as curator<br>2. Upload TXT/MD/DOCX file<br>3. Enter track title<br>4. Submit | Track created with generated steps and join code | Query: `SELECT * FROM tracks WHERE curator_id = [ID]`<br>Query: `SELECT COUNT(*) FROM steps WHERE track_id = [ID]` |
| Track Appears in Library | 1. Navigate to curator library | Created track visible with title and employee count (0) | UI shows track list |
| Track Join Code Unique | 1. Create multiple tracks | Each has unique 6-digit join code | Query: `SELECT join_code FROM tracks GROUP BY join_code HAVING COUNT(*) > 1` (should return empty) |
| Track Details Load | 1. Click track in library | Track details page shows all steps in order | Query: `SELECT * FROM steps WHERE track_id = [ID] ORDER BY order_index` |

### Employee Enrollment Tests

| Test Case | Steps | Expected Result | Verification |
|-----------|-------|-----------------|--------------|
| Join Track by Code | 1. Login as employee<br>2. Enter valid join code<br>3. Submit | Enrollment created, redirected to course player | Query: `SELECT * FROM enrollments WHERE user_id = [ID] AND track_id = [TRACK_ID]` |
| Duplicate Join Handling | 1. Enter same join code again | No error, redirected to course (existing enrollment) | Enrollment count remains 1 |
| Invalid Join Code | 1. Enter non-existent code | Error: "Invalid join code" | No enrollment created |
| Course List View | 1. Navigate to "My Courses" | Enrolled course visible with 0% progress | UI shows enrolled tracks |

### Progress Tracking Tests

| Test Case | Steps | Expected Result | Verification |
|-----------|-------|-----------------|--------------|
| Initial Progress | 1. Join course<br>2. Check enrollment | Progress = 0%, lastStepIndex = 0 | Query: `SELECT progress_pct, last_step_index FROM enrollments WHERE id = [ID]` |
| Step Advancement | 1. Complete step 1<br>2. Click next | Progress updated, lastStepIndex incremented | Query shows updated values |
| Progress Percentage Calculation | 1. Complete 50% of steps | Progress approximately 50% | Calculate: (lastStepIndex / totalSteps) * 100 |
| Course Completion | 1. Complete all steps | Progress = 100%, isCompleted = true | Query: `SELECT progress_pct, is_completed FROM enrollments WHERE id = [ID]` |
| Updated Timestamp | 1. Any progress update | updatedAt timestamp refreshed | Query: `SELECT updated_at FROM enrollments WHERE id = [ID]` |

### Drill Attempts Tests

| Test Case | Steps | Expected Result | Verification |
|-----------|-------|-----------------|--------------|
| Quiz Answer Recorded | 1. Answer quiz question | drill_attempts row created with answer | Query: `SELECT * FROM drill_attempts WHERE user_id = [ID] AND step_id = [STEP_ID]` |
| Open Question Evaluation | 1. Submit open question answer<br>2. AI evaluates | Attempt recorded with score 0-10 | Query shows score and feedback |
| Roleplay Submission | 1. Submit roleplay response | Attempt recorded with userAnswer | Query shows attempt_type = 'initial' |
| Needs Repeat Tag Added | 1. Fail step (score < 6) | Tag added to enrollment.needsRepeatTags | Query: `SELECT needs_repeat_tags FROM enrollments WHERE id = [ID]` |
| Drill Mode Attempt | 1. Practice failed steps | Attempt recorded with attemptType = 'drill_1' or 'drill_2' | Query shows multiple attempts per step |

### Analytics Tests

| Test Case | Steps | Expected Result | Verification |
|-----------|-------|-----------------|--------------|
| Curator Dashboard Analytics | 1. Login as curator with enrolled employees<br>2. View analytics | Shows total tracks, employees, avg completion, avg accuracy | Numbers match database queries |
| Track-Specific Analytics | 1. View analytics for one track | Shows employee list with progress, problem topics | Data matches enrollments and attempts |
| Problem Topics Identification | 1. Generate attempts with low accuracy for specific tags | Tags with < 80% accuracy appear in problem topics | Query: Calculate accuracy per tag |
| Employee Progress Accuracy | 1. Check employee progress in analytics | Matches enrollment.progressPct | Dashboard data = database data |

### Error Handling Tests

| Test Case | Steps | Expected Result | Verification |
|-----------|-------|-----------------|--------------|
| Database Connection Loss | 1. Stop Supabase or invalidate DATABASE_URL<br>2. Restart app | App fails to start with clear error | Error message mentions DATABASE_URL |
| Unauthorized Access | 1. Employee tries to access curator routes | 403 Forbidden or redirect | No data exposed |
| Invalid Track Access | 1. User tries to access track they're not enrolled in | 403 error with message | Access denied |
| Session Expiry | 1. Wait for session to expire<br>2. Perform action | Redirect to login, no crash | User can re-login |

### Data Consistency Tests

| Test Case | Steps | Expected Result | Verification |
|-----------|-------|-----------------|--------------|
| Referential Integrity | 1. Create track, steps, enrollments | All foreign keys valid | Query joins succeed |
| Array Column | 1. Add multiple needsRepeatTags | Array stores and retrieves correctly | Query: `SELECT needs_repeat_tags FROM enrollments WHERE id = [ID]` |
| JSONB Column | 1. Create step with complex content | JSONB stored and parsed correctly | Query: `SELECT content FROM steps WHERE id = [ID]` returns valid JSON |
| Timestamp Defaults | 1. Create any record with timestamp | Timestamps auto-populated | createdAt and updatedAt fields have values |

### Test Completion Criteria

All tests must pass before merging. If any test fails:
1. Document the failure
2. Identify root cause (app logic vs database issue)
3. Fix the issue
4. Re-run full QA checklist

**Passing Score**: 100% (no failures allowed for P0 migration)

## Deliverables

### Code Changes

**Modified Files**:
1. `.env.example` - Updated with Supabase connection template (already done)
2. `drizzle.config.ts` - Verified configuration (already correct)
3. `server/db.ts` - SSL configuration review (optional enhancement)

**New Files/Folders**:
1. `./migrations/` - Drizzle migration files (generated by drizzle-kit)
2. `README.md` or `docs/DATABASE_SETUP.md` - Migration and setup documentation

**Removed Dependencies**:
- None (no Replit DB to remove)

### Documentation Requirements

**README or Database Setup Guide** should include:

#### Local Development Setup
1. Prerequisites (Node.js, npm, Supabase account)
2. Clone repository
3. Install dependencies: `npm install`
4. Create `.env` file from `.env.example`
5. Obtain Supabase connection string
6. Set DATABASE_URL in `.env`
7. Generate migrations: `npm run db:generate` (if not committed)
8. Apply migrations: `npm run db:push` or `npm run db:migrate`
9. Start application: `npm run dev`
10. Access application at localhost

#### Migration Commands Reference
- `npm run db:generate` - Generate new migrations from schema changes
- `npm run db:migrate` - Apply pending migrations
- `npm run db:push` - Push schema directly (dev only)
- `npm run db:studio` - Open Drizzle Studio for database inspection

#### Supabase Setup Instructions
1. Create Supabase account at supabase.com
2. Create new project
3. Navigate to Settings → Database
4. Copy connection string (Transaction or Session mode)
5. Replace [YOUR-PASSWORD] with database password
6. Use connection string as DATABASE_URL

#### Environment Variables
- DATABASE_URL: Supabase Postgres connection string (required)
- SESSION_SECRET: Random secret for session encryption (required)
- AI_INTEGRATIONS_OPENAI_API_KEY: OpenAI API key (required for track generation)
- AI_INTEGRATIONS_OPENAI_BASE_URL: OpenAI API base URL (optional, defaults to openai.com)
- NODE_ENV: development or production

#### Troubleshooting
- "DATABASE_URL must be set": Ensure .env file exists with valid connection string
- SSL connection error: Verify connection string includes `?sslmode=require`
- Migration generation fails: Check schema syntax in shared/schema.ts
- Tables not appearing: Verify migrations applied successfully, check Supabase dashboard

### Pull Request Content

**PR Title**: "feat: Migrate database to Supabase Postgres"

**PR Description Template**:

```markdown
## Summary
Migrates ADAPT database from [previous hosting] to Supabase Postgres. Application already used Drizzle ORM with PostgreSQL, so this primarily involves generating and applying migrations to Supabase.

## Changes Made
- Generated Drizzle migrations from existing schema
- Applied migrations to Supabase Postgres instance
- Verified all database operations work through Supabase
- Updated documentation with setup instructions

## Database Schema
7 tables created:
- users (authentication and profiles)
- tracks (training courses)
- steps (course content)
- enrollments (user course enrollments)
- drill_attempts (user attempt records)
- conversations (AI chat)
- messages (AI chat messages)

Plus 1 session table (auto-created by connect-pg-simple)

## How to Run Migrations

### First-time setup:
1. Create Supabase project
2. Copy connection string from Supabase Dashboard → Settings → Database
3. Create `.env` file: `cp .env.example .env`
4. Set `DATABASE_URL` in `.env` with Supabase connection string
5. Apply migrations: `npm run db:push`
6. Start app: `npm run dev`

### Future migrations:
1. Modify schema in `shared/schema.ts`
2. Generate migration: `npm run db:generate`
3. Review generated SQL in `./migrations`
4. Apply migration: `npm run db:migrate`

## Verification

### Verify tables in Supabase:
1. Open Supabase Dashboard
2. Navigate to Table Editor
3. Confirm all 7 application tables exist
4. Check constraints (users.email unique, tracks.join_code unique)

### Verify application:
1. Run QA checklist (see TESTING.md or QA section in docs)
2. All core flows tested and passing
3. No database connection errors in logs

## QA Checklist Results
- [x] User registration creates users table row
- [x] Duplicate email shows correct error message
- [x] Login does not cause 404 flash
- [x] Curator can create track
- [x] Steps created for track
- [x] Employee can join with join code
- [x] Enrollment created in database
- [x] Progress updates correctly
- [x] Drill attempts recorded
- [x] Analytics queries work

## Breaking Changes
None. Application logic unchanged, only database host changed.

## Rollback Plan
If issues arise:
1. Revert DATABASE_URL to previous database
2. Application will reconnect to old database
3. Investigate Supabase-specific issues

## Next Steps
- Deploy to production with production Supabase instance
- Monitor database performance
- Consider enabling Supabase Row Level Security (future enhancement)
- AI integration improvements (separate PR)
```

### Success Metrics

Migration is considered successful when:
1. All 7 application tables exist in Supabase with correct schema
2. All QA checklist tests pass (100% pass rate)
3. Application runs without database connection errors
4. Core user flows work end-to-end (registration, track creation, enrollment, progress tracking)
5. Analytics queries return correct data
6. Session persistence works across page refreshes
7. No data loss or corruption observed
8. Documentation complete and clear

## Post-Migration Tasks

### Immediate
- [ ] Commit migration files to git
- [ ] Update README with database setup instructions
- [ ] Test deployment to production environment
- [ ] Monitor error logs for database-related issues

### Short-term (within 1 week)
- [ ] Enable Supabase connection pooler if not already enabled
- [ ] Review and optimize slow queries (use Supabase Performance tab)
- [ ] Set up database backups in Supabase (automatic, but verify)
- [ ] Configure alerts for database connection failures

### Future Enhancements (out of scope for P0)
- Consider Supabase Row Level Security policies for enhanced security
- Explore Supabase Realtime for live progress updates
- Evaluate Supabase Auth as alternative to passport.js (major change)
- Implement database query caching for analytics endpoints
- Add database indexes for frequently queried columns

## Risk Assessment and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Connection string misconfigured | Low | High | Validate connection before migration, include sslmode=require |
| Migration fails due to syntax error | Low | Medium | Review generated SQL before applying, test in dev first |
| Data type incompatibility | Very Low | Medium | Postgres-to-Postgres migration, types compatible |
| Performance degradation | Low | Medium | Monitor query performance, enable connection pooler |
| SSL certificate issues | Low | Medium | Use rejectUnauthorized: false initially, investigate later if needed |
| Session table conflicts | Very Low | Low | connect-pg-simple handles creation automatically |
| Unique constraint violations during seed | Low | Low | Seed checks if data exists before inserting |
| Lost connection during migration | Low | Medium | Use stable network, re-run migration if interrupted |

## Stop Conditions

**Do NOT proceed to next phase if**:
- Migrations fail to apply to Supabase
- Any QA checklist test fails
- Database connection errors occur
- Data integrity issues detected
- Foreign key constraints violated

**Resolve issues before continuing** to ensure stable database foundation for future AI integration work.

## Support and Resources

**Drizzle ORM Documentation**: https://orm.drizzle.team/docs/overview
**Supabase Documentation**: https://supabase.com/docs
**node-postgres Documentation**: https://node-postgres.com/
**connect-pg-simple Documentation**: https://github.com/voxpelli/node-connect-pg-simple

**Common Supabase Connection Patterns**:
- Transaction mode: Best for serverless/short-lived connections
- Session mode: Best for persistent connection pools (current setup)
- Connection pooler: Recommended for production (port 6543)

**Debugging Tips**:
- Check Supabase logs in Dashboard → Logs
- Use Drizzle Studio to inspect database: `npm run db:studio`
- Run raw SQL queries in Supabase SQL Editor for verification
- Enable verbose logging in node-postgres for connection debugging
