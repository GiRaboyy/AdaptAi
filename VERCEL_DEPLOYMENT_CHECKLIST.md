# Vercel Deployment Checklist

## Pre-Deployment Validation

- [x] TypeScript compilation passes (`npm run check`)
- [x] Build completes successfully (`npm run build`)
- [x] Both bundles created (`dist/index.cjs` and `dist/server-app.cjs`)
- [x] Frontend static files in `dist/public/`
- [ ] All changes committed to git
- [ ] Code pushed to GitHub repository

## Vercel Dashboard Configuration

### Build Settings

Navigate to: **Project Settings → Build & Development Settings**

| Setting | Value |
|---------|-------|
| Framework Preset | `Vite` |
| Root Directory | `.` (leave empty) |
| Build Command | `npm run build` |
| Output Directory | `dist/public` |
| Install Command | `npm install` |
| Node.js Version | `20.x` |

### Environment Variables

Navigate to: **Project Settings → Environment Variables**

#### Critical Variables (Must Set)

```bash
# Database
DATABASE_URL=postgresql://postgres:[password]@db.suicubrscstxnniaraxh.supabase.co:5432/postgres
DATABASE_FILE_STORAGE_URL=https://suicubrscstxnniaraxh.supabase.co
DATABASE_FILE_STORAGE_KEY=[your-service-role-key]

# Auth
SUPABASE_ANON_KEY=[your-anon-key]
SESSION_SECRET=[random-32-char-string]

# Application
NODE_ENV=production
APP_URL=https://your-app.vercel.app
```

#### AI Generation (Required for course generation)

```bash
YANDEX_CLOUD_API_KEY=[your-key]
YANDEX_CLOUD_PROJECT_FOLDER_ID=[your-folder-id]
YANDEX_PROMPT_ID=[your-prompt-id]
YANDEX_TIMEOUT_MS=90000
```

#### Email (Optional - for email verification)

```bash
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=adapt-ai@yandex.com
SMTP_PASSWORD=[your-app-password]
SMTP_FROM=ADAPT <adapt-ai@yandex.com>
```

#### Client-Side (Vite build-time variables)

```bash
VITE_SUPABASE_URL=https://suicubrscstxnniaraxh.supabase.co
VITE_SUPABASE_ANON_KEY=[same-as-SUPABASE_ANON_KEY]
```

#### Optional Configuration

```bash
COOKIE_SECURE=true
LOG_LEVEL=info
REQUEST_LOG_SAMPLE=1
OWNER_TELEGRAM=@YourHandle
```

### Function Configuration

Navigate to: **Project Settings → Functions**

| Setting | Value |
|---------|-------|
| Region | Closest to your database |
| Memory | 1024 MB |
| Max Duration | 60 seconds |

## Deployment Process

### Option 1: Automatic Deployment (Recommended)

1. Push to GitHub:
   ```bash
   git push origin main
   ```

2. Vercel automatically detects push and starts deployment

3. Monitor deployment in Vercel dashboard

### Option 2: Manual Deployment via CLI

1. Install Vercel CLI (if not installed):
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy to preview:
   ```bash
   vercel
   ```

4. Deploy to production:
   ```bash
   vercel --prod
   ```

## Post-Deployment Verification

### Immediate Checks (Within 5 minutes)

- [ ] **Frontend loads**: Visit `https://your-app.vercel.app/`
  - Should show landing page without white screen
  - No 404 errors in browser console
  - Static assets load correctly

- [ ] **Health endpoint**: Test API availability
  ```bash
  curl https://your-app.vercel.app/api/health
  ```
  Expected response:
  ```json
  {
    "ok": true,
    "nodeEnv": "production",
    "hasDatabase": true,
    "hasSessionSecret": true,
    "timestamp": "2026-02-01T..."
  }
  ```

- [ ] **API routing**: Test endpoints don't 404
  ```bash
  curl -X POST https://your-app.vercel.app/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test@example.com","password":"test"}'
  ```
  Expected: 401 (Unauthorized) - NOT 404

- [ ] **Function logs**: Check Vercel dashboard → Functions → Logs
  - Should see: `[Vercel Function] Loading from compiled bundle...`
  - Should NOT see: `Cannot find module` errors

### Functional Testing (Within 15 minutes)

- [ ] **User Registration**:
  1. Navigate to `/auth`
  2. Fill registration form
  3. Submit
  4. Verify email sent (check logs if SMTP configured)
  5. Confirm no errors in console

- [ ] **User Login**:
  1. Navigate to `/auth`
  2. Enter credentials
  3. Submit
  4. Verify redirect to dashboard
  5. Check authentication works

- [ ] **Protected Routes**:
  1. Access `/curator/dashboard` without login → redirects to auth
  2. Login as curator → can access dashboard
  3. Try accessing employee-only route → should be denied

- [ ] **Course Generation** (if not trial-limited):
  1. Login as curator
  2. Upload test files
  3. Submit course generation
  4. Verify generation completes
  5. Check course appears in library

### Performance Checks (Within 1 hour)

- [ ] **Cold Start Time**: 
  - First request to new function instance
  - Should be < 10 seconds
  - Check Vercel logs for timing

- [ ] **Warm Request Time**:
  - Subsequent requests
  - Should be < 2 seconds
  - Test with multiple rapid requests

- [ ] **Database Connectivity**:
  - Monitor connection pool usage
  - Check for connection timeout errors
  - Verify queries complete successfully

## Troubleshooting Guide

### Issue: Frontend shows white screen

**Cause**: Static files not serving correctly

**Fix**:
1. Check build output directory is `dist/public`
2. Verify files exist in Vercel deployment
3. Check browser console for 404 errors
4. Verify `routes` configuration in vercel.json

### Issue: API returns 404

**Cause**: Routing not configured properly

**Fix**:
1. Verify `vercel.json` has API routing rules
2. Check function files exist in `api/` directory
3. Ensure `api/[...path].ts` compiled during build
4. Check Vercel logs for routing errors

### Issue: API returns 500 - Module not found

**Cause**: Import path incorrect or bundle missing

**Fix**:
1. Verify `dist/server-app.cjs` exists in deployment
2. Check build logs for esbuild errors
3. Ensure `NODE_ENV=production` is set
4. Check function logs for import error details

### Issue: Database connection fails

**Cause**: Environment variables not set or incorrect

**Fix**:
1. Verify `DATABASE_URL` is set correctly
2. Check Supabase database is accessible
3. Verify SSL mode in connection string
4. Test connection from Vercel region

### Issue: Authentication not working

**Cause**: Session or JWT configuration issues

**Fix**:
1. Verify `SESSION_SECRET` is set
2. Check `SUPABASE_ANON_KEY` is correct
3. Ensure `trust proxy` is set in app.ts
4. Verify cookies are being set (check Network tab)

### Issue: SMTP errors

**Cause**: Email configuration incorrect

**Fix**:
1. Verify all SMTP_* variables are set
2. Test SMTP credentials externally
3. Check firewall/security restrictions
4. Review email logs in Vercel dashboard

## Monitoring Strategy

### First 24 Hours

**Check every 2 hours**:
- Error rate in Vercel analytics
- Function execution times
- Database connection pool status
- User-reported issues

**Monitor**:
- Vercel Functions → Logs (filter by Error)
- Database connection count
- Response time metrics
- HTTP status code distribution

### Ongoing Monitoring

**Daily**:
- Review error logs
- Check function execution metrics
- Monitor database query performance

**Weekly**:
- Analyze usage patterns
- Review cold start frequency
- Optimize slow queries
- Update dependencies

## Success Criteria

### Technical
- ✅ Build succeeds without errors
- ✅ All API endpoints return non-404
- ✅ Frontend loads in < 3 seconds
- ✅ API cold start < 10 seconds
- ✅ Error rate < 0.1%

### Functional
- ✅ Users can register and login
- ✅ Curators can create courses
- ✅ Employees can join courses
- ✅ Course generation completes successfully
- ✅ Analytics display correctly

## Rollback Procedure

If critical issues arise:

1. **Immediate rollback**:
   - Vercel Dashboard → Deployments
   - Find previous working deployment
   - Click "..." → "Promote to Production"

2. **Investigate in preview**:
   - Create feature branch
   - Push to GitHub
   - Test in Vercel preview environment
   - Fix issues before promoting

3. **Re-deploy**:
   - Once fixed, merge to main
   - Automatic production deployment
   - Verify all checks pass

## Support Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Vercel Support**: https://vercel.com/support
- **Supabase Docs**: https://supabase.com/docs
- **Project Documentation**: See `/docs` folder

---

**Last Updated**: February 1, 2026  
**Deployment Ready**: ✅ YES
