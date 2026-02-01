# Vercel Deployment Guide

Complete guide for deploying ADAPT to Vercel with proper configuration.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Project**: Active Supabase project with PostgreSQL database
3. **Yandex Cloud API**: API key and project folder ID
4. **SMTP Account**: Email service credentials (Yandex Mail recommended)

## Deployment Steps

### 1. Prepare Repository

Ensure your repository is ready:

```bash
# Run type check
npm run check

# Test build locally
npm run build

# Verify dist/public exists
ls -la dist/public

# Verify dist/server-app.cjs exists
ls -la dist/server-app.cjs
```

### 2. Connect Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Configure build settings:
   - **Framework Preset**: Other
   - **Root Directory**: `.` (repository root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`

### 3. Configure Environment Variables

Add all required environment variables in Vercel:

Go to **Project Settings → Environment Variables**

#### Database (Required)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | From Supabase Dashboard → Settings → Database |
| `DATABASE_FILE_STORAGE_URL` | `https://xxx.supabase.co` | Supabase project URL |
| `DATABASE_FILE_STORAGE_KEY` | `eyJhbGc...` | Supabase service role key |
| `SUPABASE_ANON_KEY` | `eyJhbGc...` | Supabase anon/public key |

#### Application (Required)

| Variable | Value | Notes |
|----------|-------|-------|
| `APP_URL` | `https://your-app.vercel.app` | Your production domain |
| `SESSION_SECRET` | `<random-32-chars>` | Generate: `openssl rand -base64 32` |
| `COOKIE_SECURE` | `true` | Enable secure cookies for HTTPS |

#### AI Service (Required)

| Variable | Value | Notes |
|----------|-------|-------|
| `YANDEX_CLOUD_API_KEY` | `your-key` | Yandex Cloud API key |
| `YANDEX_CLOUD_PROJECT_FOLDER_ID` | `your-folder-id` | Yandex project folder |
| `YANDEX_PROMPT_ID` | `your-prompt-id` | Yandex prompt template ID |

#### Email (Required)

| Variable | Value | Notes |
|----------|-------|-------|
| `SMTP_HOST` | `smtp.yandex.ru` | SMTP server hostname |
| `SMTP_PORT` | `465` | SMTP port (465 or 587) |
| `SMTP_USER` | `adapt-ai@yandex.com` | Your email address |
| `SMTP_PASSWORD` | `app-password` | App password (not regular password) |
| `SMTP_FROM` | `ADAPT <adapt-ai@yandex.com>` | From header for emails |

#### Frontend (Required)

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Same as DATABASE_FILE_STORAGE_URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | Same as SUPABASE_ANON_KEY |

**Important**: `VITE_*` variables are bundled into the frontend during build. Update them in both Vercel settings and redeploy.

### 4. Run Database Migration

Before first deployment, apply the database migration:

```bash
# Connect to your Supabase database
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Run migration
\i migrations/0007_email_verification_sync.sql

# Verify triggers exist
\df public.handle_new_auth_user
\df public.sync_email_verification
```

Or use Supabase Dashboard:
1. Go to **SQL Editor**
2. Copy content from `migrations/0007_email_verification_sync.sql`
3. Execute query

### 5. Deploy

Push to your Git repository:

```bash
git add .
git commit -m "Configure Vercel deployment"
git push origin main
```

Vercel will automatically:
1. Detect the push
2. Install dependencies
3. Run build script
4. Deploy to production

### 6. Verify Deployment

Check deployment health:

#### Test API Endpoints

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Expected response:
{
  "ok": true,
  "nodeEnv": "production",
  "hasDatabase": true,
  "hasSessionSecret": true,
  "timestamp": "2026-02-01T..."
}
```

#### Test Static Assets

Visit in browser:
- `https://your-app.vercel.app/` → Landing page loads
- `https://your-app.vercel.app/auth` → Auth page loads
- `https://your-app.vercel.app/favicon.ico` → Favicon loads (no 401)

#### Test SPA Routing

Direct URL access should work:
- `https://your-app.vercel.app/curator` → Curator dashboard (after login)
- `https://your-app.vercel.app/app/join` → Employee join page
- Refresh on any route → No 404 error

### 7. Test Email Flow

Complete registration flow:

1. **Register**: Go to `/auth` and create account
2. **Verify Screen**: Should show "Check your email"
3. **Check Email**: Receive verification email
4. **Click Link**: Should redirect to `/auth/callback`
5. **Success Screen**: Should show "Email confirmed"
6. **Login**: Should redirect to dashboard
7. **Profile Loads**: No "Profile not found" error

### 8. Monitor Logs

Check Vercel deployment logs:

1. Go to **Vercel Dashboard → Your Project → Deployments**
2. Click on latest deployment
3. View **Functions** tab for serverless logs
4. Check for:
   - No `ERR_MODULE_NOT_FOUND` errors
   - Profile creation logs: `Created new profile for auth user: ...`
   - Email verification logs: `Synced email verification for auth user: ...`

## Troubleshooting

### Error: ERR_MODULE_NOT_FOUND

**Cause**: API function can't find compiled server app.

**Solution**:
1. Verify `dist/server-app.cjs` is created during build
2. Check `api/[...path].ts` imports from correct path
3. Ensure build script runs: `tsx script/build.ts`

### Error: Profile not found

**Cause**: Database trigger didn't create profile.

**Solution**:
1. Verify migration 0007 is applied
2. Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
3. Test trigger manually by creating user in Supabase Dashboard
4. Fallback: Middleware in `auth-supabase.ts` will create profile

### Error: Email not sent

**Cause**: SMTP configuration issue.

**Solution**:
1. Verify SMTP credentials are correct
2. Test SMTP connection with: `npm run test:email` (if available)
3. Check Vercel logs for SMTP errors
4. Generate new app password at https://id.yandex.ru/security

### Error: 401 on static assets

**Cause**: Middleware interfering with asset requests.

**Solution**:
1. Check no Edge Middleware in `middleware.ts`
2. Verify `vercel.json` routes are correct
3. Ensure filesystem handler comes first

### Error: SPA routes return 404

**Cause**: Incorrect routing configuration.

**Solution**:
1. Verify `vercel.json` has SPA fallback: `{ "source": "/(.*)", "destination": "/index.html" }`
2. Ensure API routes are excluded: `{ "source": "/api/(.*)", "destination": "/api/$1" }`
3. Redeploy after changing `vercel.json`

## Performance Optimization

### Cold Start Time

Monitor function cold start:
- Target: < 3 seconds
- Check: Vercel Dashboard → Analytics → Functions

If cold starts are slow:
1. Review bundle size in `dist/server-app.cjs`
2. Add more dependencies to externals in `script/build.ts`
3. Increase function memory to 1024 MB (already set)

### Database Connections

Serverless functions reuse connections:
- Pool max: 20 connections (see `server/db.ts`)
- Warm containers cache connections
- Monitor active connections in Supabase Dashboard

## Rollback Plan

If deployment fails:

### Quick Rollback
1. Go to **Vercel Dashboard → Deployments**
2. Find previous working deployment
3. Click **︙** → **Promote to Production**

### Revert Database Migration
```sql
-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_email_confirmed ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.sync_email_verification();
```

### Revert Code Changes
```bash
git revert HEAD
git push origin main
```

## Security Checklist

- [ ] All environment variables set in Vercel (not in code)
- [ ] `COOKIE_SECURE=true` in production
- [ ] `SESSION_SECRET` is random and secure (32+ characters)
- [ ] Supabase RLS policies enabled on `public.users`
- [ ] Service role key kept server-side only
- [ ] No secrets in Git repository
- [ ] `.env` file in `.gitignore`

## Support

If issues persist:

1. **Check Logs**: Vercel Dashboard → Functions → View logs
2. **Check Database**: Supabase Dashboard → Database → Check triggers/policies
3. **Check Design Doc**: Refer to `/docs/VERCEL_DEPLOYMENT_STABILIZATION.md`
4. **Test Locally**: Ensure `npm run build && npm run start` works

## Next Steps

After successful deployment:

1. **Custom Domain**: Add custom domain in Vercel settings
2. **Monitoring**: Set up Vercel Analytics
3. **Alerts**: Configure error alerts in Vercel
4. **Backups**: Set up Supabase backup schedule
5. **CI/CD**: Configure automated tests before deployment

---

**Last Updated**: February 2026  
**Maintained By**: ADAPT Team
