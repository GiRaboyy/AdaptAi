# ✅ Vercel Deployment Checklist

## 📋 Pre-Deployment

- [x] `vercel.json` created
- [x] Environment validation added (`client/src/lib/env-validation.ts`)
- [x] Supabase client updated with validation
- [x] Documentation created
- [ ] All changes committed to Git
- [ ] Changes pushed to GitHub

## 🔧 Vercel Configuration

### Project Settings
- [ ] Framework Preset: `Other`
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Install Command: `npm ci`
- [ ] Node.js Version: `20.x`
- [ ] Root Directory: `/`

## 🔐 Environment Variables

### Required for ALL environments (Development, Preview, Production)

#### Database
- [ ] `DATABASE_URL` - PostgreSQL connection string

#### Supabase (Backend)
- [ ] `DATABASE_FILE_STORAGE_URL` - Supabase project URL
- [ ] `DATABASE_FILE_STORAGE_KEY` - Service role key (⚠️ SECRET)
- [ ] `SUPABASE_ANON_KEY` - Anon public key

#### Supabase (Frontend - VITE_ prefix)
- [ ] `VITE_SUPABASE_URL` - Same as DATABASE_FILE_STORAGE_URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Same as SUPABASE_ANON_KEY

#### Application URLs
- [ ] `APP_URL` - Your Vercel domain (e.g., https://your-app.vercel.app)
- [ ] `VITE_APP_URL` - Same as APP_URL

#### Security
- [ ] `SESSION_SECRET` - Random 32+ character string
- [ ] `COOKIE_SECURE` - Set to `true` for production

#### AI (Yandex Cloud)
- [ ] `YANDEX_CLOUD_API_KEY`
- [ ] `YANDEX_CLOUD_PROJECT_FOLDER_ID`
- [ ] `YANDEX_CLOUD_BASE_URL`
- [ ] `YANDEX_PROMPT_ID`
- [ ] `YANDEX_TIMEOUT_MS`

#### Email (SMTP)
- [ ] `SMTP_HOST`
- [ ] `SMTP_PORT`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASSWORD`
- [ ] `SMTP_FROM`

#### System
- [ ] `NODE_ENV` - Set to `production`
- [ ] `PORT` - Set to `5000`
- [ ] `HOST` - Set to `0.0.0.0`
- [ ] `LOG_LEVEL` - Set to `info`
- [ ] `LOG_PRETTY` - Set to `false`
- [ ] `SHUTDOWN_TIMEOUT_MS` - Set to `10000`
- [ ] `REQUEST_LOG_SAMPLE` - Set to `0.1`

## 🔗 Supabase Configuration

### Authentication Settings
- [ ] Go to: Supabase Dashboard → Authentication → URL Configuration
- [ ] Add Redirect URL: `https://your-domain.vercel.app/auth/callback`
- [ ] Update Site URL: `https://your-domain.vercel.app`

## 🚀 Deploy

- [ ] Commit all changes: `git add . && git commit -m "Fix Vercel deployment"`
- [ ] Push to GitHub: `git push`
- [ ] Wait for Vercel to build and deploy
- [ ] Check deployment logs for errors

## ✅ Post-Deployment Verification

### Basic Functionality
- [ ] Homepage `/` loads without 404
- [ ] Auth page `/auth` is accessible
- [ ] Direct link to `/app/courses` works
- [ ] Direct link to `/curator` works
- [ ] Direct link to `/curator/course/123` works
- [ ] Browser refresh (F5) on any route doesn't show 404

### Authentication
- [ ] Login form works
- [ ] Registration form works
- [ ] Email verification works
- [ ] Logout works
- [ ] Session persists on refresh

### API & Backend
- [ ] API requests succeed (check Network tab)
- [ ] Database queries work
- [ ] File uploads work (if applicable)
- [ ] Email sending works (if applicable)

### Environment & Console
- [ ] No "Missing environment variables" errors in browser console
- [ ] No 404 errors in browser console
- [ ] No Supabase connection errors
- [ ] Vercel function logs show no errors

### Performance
- [ ] Page loads in reasonable time (< 3 seconds)
- [ ] No timeout errors
- [ ] Assets load correctly (CSS, JS, images)

## 🐛 If Issues Occur

### 404 on all routes
1. [ ] Check `vercel.json` exists in repository
2. [ ] Check Vercel build logs for errors
3. [ ] Verify `dist/index.cjs` was created during build
4. [ ] Check Vercel project settings match requirements

### Environment variable errors
1. [ ] Verify all `VITE_*` variables are set in Vercel
2. [ ] Check variable names are exactly correct (case-sensitive)
3. [ ] Verify values don't have extra spaces or quotes
4. [ ] Redeploy after adding variables

### Supabase auth fails
1. [ ] Check `VITE_SUPABASE_URL` matches Supabase Dashboard
2. [ ] Check `VITE_SUPABASE_ANON_KEY` matches Supabase Dashboard
3. [ ] Verify redirect URLs in Supabase include Vercel domain
4. [ ] Check `APP_URL` points to Vercel domain, not localhost

### Email verification doesn't work
1. [ ] Verify `APP_URL` is set to Vercel domain
2. [ ] Check `VITE_APP_URL` is set to Vercel domain
3. [ ] Verify Supabase redirect URLs include `/auth/callback`
4. [ ] Test email delivery in Supabase logs

### Database connection fails
1. [ ] Check `DATABASE_URL` format is correct
2. [ ] Verify `?sslmode=require` is in connection string
3. [ ] Check Supabase allows connections from Vercel
4. [ ] Test connection from Vercel function logs

## 📚 Documentation Reference

- **Complete Guide**: `VERCEL_DEPLOYMENT_GUIDE.md`
- **Summary (Russian)**: `VERCEL_FIX_SUMMARY.md`
- **Technical Report**: `DEPLOYMENT_FIX_REPORT.md`
- **Env Template**: `.env.vercel.template`

## 🎉 Success Criteria

All checkboxes above are checked, and:
- ✅ Application loads on Vercel domain
- ✅ All routes work correctly
- ✅ Authentication functions properly
- ✅ No console errors
- ✅ Email verification works
- ✅ Database operations succeed

---

**Status**: Ready to deploy! 🚀

Once all items are checked, your application will be fully operational on Vercel.
