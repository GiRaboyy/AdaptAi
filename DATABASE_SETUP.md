# Database Setup Guide - ADAPT

This guide covers setting up the ADAPT application with Supabase Postgres database.

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier available at [supabase.com](https://supabase.com))
- Git (for cloning the repository)

## Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: ADAPT (or your preferred name)
   - **Database Password**: Generate a strong password and save it securely
   - **Region**: Choose closest to your location
5. Wait for project provisioning (1-2 minutes)

### 2. Get Connection String

1. In your Supabase project, navigate to **Settings** → **Database**
2. Scroll to **Connection string** section
3. Select **URI** tab (not Transaction or Session pooling)
4. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with your actual database password
6. Add `?sslmode=require` at the end:
   ```
   postgresql://postgres:YourPassword123@db.abcdefghijklmnop.supabase.co:5432/postgres?sslmode=require
   ```

### 3. Configure Environment

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and set your credentials:
   ```env
   DATABASE_URL=postgresql://postgres:YourPassword123@db.abcdefghijklmnop.supabase.co:5432/postgres?sslmode=require
   SESSION_SECRET=your-random-secret-change-in-production
   AI_INTEGRATIONS_OPENAI_API_KEY=sk-your-openai-key
   AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
   NODE_ENV=development
   ```

3. Generate a secure `SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### 4. Install Dependencies

```bash
npm install
```

### 5. Apply Database Migrations

For initial setup, use the push command:

```bash
npm run db:push
```

This will:
- Connect to your Supabase database
- Create all 7 application tables (users, tracks, steps, enrollments, drill_attempts, conversations, messages)
- Apply schema constraints (unique indexes, NOT NULL, etc.)

**Alternative** - Generate and apply migrations (recommended for production):

```bash
# Generate migration files from schema
npm run db:generate

# Review generated SQL in ./migrations folder

# Apply migrations
npm run db:migrate
```

### 6. Verify Database Setup

1. Go to Supabase Dashboard → **Table Editor**
2. You should see these tables:
   - `users`
   - `tracks`
   - `steps`
   - `enrollments`
   - `drill_attempts`
   - `conversations`
   - `messages`
   - `session` (auto-created by connect-pg-simple)

### 7. Start the Application

```bash
npm run dev
```

The app will:
- Start on `http://localhost:5000` (or configured port)
- Automatically seed demo data (curator and employee users)
- Create a sample track "Customer Empathy 101"

**Test credentials** (created by seed script):
- Curator: `curator@adapt.com` / `curator123`
- Employee: `employee@adapt.com` / `employee123`

## Database Schema

### Tables Overview

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| **users** | User accounts and profiles | id, email (unique), password, role, name |
| **tracks** | Training courses | id, curatorId, title, joinCode (unique), rawKnowledgeBase |
| **steps** | Course content steps | id, trackId, type, content (jsonb), orderIndex |
| **enrollments** | User course enrollments | id, userId, trackId, progressPct, needsRepeatTags (text[]) |
| **drill_attempts** | Student attempt records | id, userId, stepId, trackId, isCorrect, score |
| **conversations** | AI chat conversations | id, title, createdAt |
| **messages** | AI chat messages | id, conversationId, role, content |

### Key Constraints

- `users.email` is UNIQUE and NOT NULL
- `tracks.joinCode` is UNIQUE and NOT NULL (6-digit codes for course access)
- `enrollments.needsRepeatTags` is a text array for drill mode
- `steps.content` is JSONB for flexible content structures

## Migration Commands Reference

### Development

```bash
# Push schema changes directly (fast, no migration history)
npm run db:push

# Open Drizzle Studio to browse database
npm run db:studio
```

### Production Workflow

```bash
# 1. Modify schema in shared/schema.ts

# 2. Generate migration file
npm run db:generate

# 3. Review generated SQL in ./migrations folder

# 4. Apply migration to database
npm run db:migrate
```

## Troubleshooting

### "DATABASE_URL must be set"

**Cause**: Missing or invalid `.env` file

**Solution**:
1. Ensure `.env` file exists in project root
2. Verify `DATABASE_URL` is set with valid Supabase connection string
3. Restart terminal/application after setting environment variables

### "SSL connection required"

**Cause**: Connection string missing `?sslmode=require`

**Solution**: Add `?sslmode=require` to the end of your DATABASE_URL:
```
postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres?sslmode=require
```

### "ECONNREFUSED" or connection timeout

**Cause**: Network issues or incorrect connection string

**Solution**:
1. Verify your Supabase project is active (check dashboard)
2. Check your internet connection
3. Verify the connection string project reference matches your Supabase project
4. Ensure no firewall blocking port 5432

### "relation does not exist" errors

**Cause**: Migrations not applied or tables not created

**Solution**:
1. Run `npm run db:push` to create tables
2. Verify tables exist in Supabase Table Editor
3. If tables exist but app can't find them, check schema name (should be `public`)

### Migration generation fails

**Cause**: Syntax error in schema or DATABASE_URL not set

**Solution**:
1. Check `shared/schema.ts` for Drizzle syntax errors
2. Ensure DATABASE_URL is set before running `db:generate`
3. Review error message for specific schema issues

### Session table not found

**Cause**: connect-pg-simple hasn't created session table yet

**Solution**: This is normal on first run. The session table is auto-created on first connection. If issues persist:
1. Restart the application
2. Check Supabase logs for errors
3. Verify database user has CREATE TABLE permissions

## Production Deployment

### Environment Variables

Set these in your production environment (Vercel, Railway, etc.):

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
SESSION_SECRET=generate-a-strong-random-secret
AI_INTEGRATIONS_OPENAI_API_KEY=sk-your-production-key
NODE_ENV=production
```

### Connection Pooling

For production, consider using Supabase's connection pooler (port 6543):

```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?sslmode=require
```

Benefits:
- Better connection management
- Reduces connection overhead
- Handles connection spikes

### Security Best Practices

1. **Never commit** `.env` file to git (already in `.gitignore`)
2. **Rotate passwords** if accidentally exposed
3. **Use environment variables** in deployment platforms
4. **Enable Supabase Row Level Security** for additional protection (future enhancement)
5. **Set strong SESSION_SECRET** (at least 32 characters random)

## Verification Queries

Use Supabase SQL Editor to verify database state:

### Check all tables exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Verify unique constraints
```sql
SELECT conname, contype, conrelid::regclass as table
FROM pg_constraint
WHERE contype = 'u' 
  AND connamespace = 'public'::regnamespace;
```

### Check array column (enrollments.needs_repeat_tags)
```sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'enrollments' 
  AND column_name = 'needs_repeat_tags';
```

### Verify JSONB column (steps.content)
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'steps' 
  AND column_name = 'content';
```

### Count seed data
```sql
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'tracks', COUNT(*) FROM tracks
UNION ALL
SELECT 'steps', COUNT(*) FROM steps;
```

## Support Resources

- **Drizzle ORM Docs**: [orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Supabase Postgres**: [supabase.com/docs/guides/database](https://supabase.com/docs/guides/database)
- **node-postgres**: [node-postgres.com](https://node-postgres.com/)

## Common Workflows

### Adding a New Table

1. Define table in `shared/schema.ts`:
   ```typescript
   export const yourTable = pgTable("your_table", {
     id: serial("id").primaryKey(),
     name: text("name").notNull(),
   });
   ```

2. Generate migration:
   ```bash
   npm run db:generate
   ```

3. Apply migration:
   ```bash
   npm run db:migrate
   ```

### Modifying Existing Table

1. Update table definition in `shared/schema.ts`
2. Generate migration: `npm run db:generate`
3. Review generated SQL (it should show ALTER TABLE statements)
4. Apply migration: `npm run db:migrate`

### Resetting Database (Development Only)

⚠️ **Warning**: This deletes all data!

1. Go to Supabase SQL Editor
2. Run:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
3. Re-apply migrations: `npm run db:push`

### Backing Up Database

Supabase provides automatic daily backups. To create manual backup:

1. Supabase Dashboard → **Database** → **Backups**
2. Click **Create backup**
3. Download if needed

## Next Steps

After successful setup:

1. ✅ Create your first curator account
2. ✅ Upload training materials and generate a course
3. ✅ Test employee enrollment with join code
4. ✅ Monitor analytics dashboard
5. ✅ Configure production environment with production Supabase instance

For questions or issues, refer to the main README or create an issue in the repository.
