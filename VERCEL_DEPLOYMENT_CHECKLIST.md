# Vercel Deployment Checklist

Quick reference for deploying ADAPT to Vercel.

## Pre-Deployment

- [ ] Code passes TypeScript check: `npm run check`
- [ ] Build completes successfully: `npm run build`
- [ ] Local dev server works: `npm run dev`
- [ ] Test registration flow locally

## Vercel Setup

- [ ] Create new project on Vercel
- [ ] Connect Git repository
- [ ] Set build settings:
  - Build Command: `npm run build`
  - Output Directory: `dist/public`
  - Install Command: `npm install`

## Database Migration

- [ ] Connect to Supabase database
- [ ] Run migration: `migrations/0007_email_verification_sync.sql`
- [ ] Verify triggers:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname IN ('on_auth_user_created', 'on_auth_email_confirmed');
  ```

## Environment Variables

Copy from `.env.example` and set in Vercel:

### Database (4 variables)
- [ ] `DATABASE_URL`
- [ ] `DATABASE_FILE_STORAGE_URL`
- [ ] `DATABASE_FILE_STORAGE_KEY`
- [ ] `SUPABASE_ANON_KEY`

### Application (3 variables)
- [ ] `APP_URL` (your production domain)
- [ ] `SESSION_SECRET` (generate: `openssl rand -base64 32`)
- [ ] `COOKIE_SECURE=true`

### AI Service (3 variables)
- [ ] `YANDEX_CLOUD_API_KEY`
- [ ] `YANDEX_CLOUD_PROJECT_FOLDER_ID`
- [ ] `YANDEX_PROMPT_ID`

### Email (5 variables)
- [ ] `SMTP_HOST`
- [ ] `SMTP_PORT`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASSWORD`
- [ ] `SMTP_FROM`

### Frontend (2 variables)
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`

## Deploy

- [ ] Commit changes: `git commit -am "Configure Vercel deployment"`
- [ ] Push to Git: `git push origin main`
- [ ] Wait for Vercel deployment
- [ ] Check deployment logs for errors

## Verification

### API Health
- [ ] Visit: `https://your-app.vercel.app/api/health`
- [ ] Response has `"ok": true`
- [ ] Response has `"hasDatabase": true`

### Static Assets
- [ ] Landing page loads: `https://your-app.vercel.app/`
- [ ] Auth page loads: `https://your-app.vercel.app/auth`
- [ ] Favicon loads (no 401): `https://your-app.vercel.app/favicon.ico`

### SPA Routing
- [ ] Direct access works: `https://your-app.vercel.app/curator`
- [ ] Refresh doesn't 404
- [ ] Deep links work: `https://your-app.vercel.app/app/join`

### Email Flow (End-to-End)
- [ ] Register new account at `/auth`
- [ ] See "Check your email" screen
- [ ] Receive verification email
- [ ] Click email link
- [ ] Redirects to `/auth/callback`
- [ ] Shows "Email confirmed" success
- [ ] Login works
- [ ] Profile loads (no "Profile not found")
- [ ] Dashboard displays correctly

### Database
- [ ] User exists in `auth.users` (Supabase Dashboard)
- [ ] Profile exists in `public.users` (check `auth_uid` matches)
- [ ] `email_verified = true` after confirmation

## Monitoring

- [ ] Check Vercel Function logs
- [ ] Look for profile creation logs: `Created new profile for auth user`
- [ ] Look for email sync logs: `Synced email verification for auth user`
- [ ] No `ERR_MODULE_NOT_FOUND` errors
- [ ] No TypeScript errors

## If Deployment Fails

1. Check Vercel build logs for errors
2. Verify all environment variables are set
3. Test migration ran successfully
4. Review [docs/VERCEL_DEPLOYMENT.md](./docs/VERCEL_DEPLOYMENT.md) troubleshooting section
5. Rollback: Promote previous deployment in Vercel dashboard

## Success Criteria

All checkboxes above should be checked ✅

**Ready for production**: When all verification steps pass

---

**Quick Help**:
- Full guide: [docs/VERCEL_DEPLOYMENT.md](./docs/VERCEL_DEPLOYMENT.md)
- Environment vars: [.env.example](./.env.example)
- Implementation details: [IMPLEMENTATION_VERCEL_STABILIZATION.md](./IMPLEMENTATION_VERCEL_STABILIZATION.md)
