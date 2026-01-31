# 🚀 Vercel Deployment Guide - AdaptAI

## ✅ Fixed Issues

### Root Cause Analysis
1. **404 Error**: Missing `vercel.json` configuration - Vercel was treating the app as a static SPA instead of a Node.js server
2. **Architecture**: This is a **fullstack Express + React (Vite)** application that requires Node.js runtime
3. **Routing**: The app uses:
   - **Server-side**: Express handles API routes and serves static files
   - **Client-side**: Wouter (React Router alternative) handles SPA routing
   - **Catch-all**: Server's `static.ts` already had SPA fallback to `index.html` ✅

### What Was Fixed
- ✅ Created `vercel.json` with Node.js configuration
- ✅ Added environment variable validation (`client/src/lib/env-validation.ts`)
- ✅ Improved Supabase client initialization with proper error handling
- ✅ Updated environment variable usage to use validation helpers
- ✅ No design changes - only deployment and environment configuration

---

## 📋 Vercel Project Settings

### Build & Development Settings

```
Framework Preset: Other
Build Command: npm run build
Output Directory: dist
Install Command: npm ci
Development Command: npm run dev
Root Directory: /
Node.js Version: 20.x
```

### How It Works

The build process:
1. Runs `npm run build` which executes `script/build.ts`
2. Builds the React client with Vite → `dist/public/`
3. Bundles the Express server with esbuild → `dist/index.cjs`
4. Vercel uses `dist/index.cjs` as the serverless function entry point
5. Server serves static files from `dist/public/` and handles all routes

---

## 🔐 Environment Variables

### Required Variables (MUST SET)

Add these in **Vercel Project Settings → Environment Variables** for all environments (Development, Preview, Production):

#### 1. Database (PostgreSQL)
```bash
DATABASE_URL=postgresql://postgres:password@host:5432/database?sslmode=require
```
Get from: Supabase Dashboard → Settings → Database → Connection string (URI)

#### 2. Supabase Configuration (Backend)
```bash
DATABASE_FILE_STORAGE_URL=https://your-project-ref.supabase.co
DATABASE_FILE_STORAGE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```
Get from: Supabase Dashboard → Settings → API

**⚠️ IMPORTANT**: 
- `DATABASE_FILE_STORAGE_KEY` is the **service role key** (server-side only, NEVER exposed to client)
- `SUPABASE_ANON_KEY` is the **anon public key** (used for JWT validation)

#### 3. Supabase Configuration (Frontend - VITE_ prefix)
```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
**⚠️ IMPORTANT**: Must use `VITE_` prefix to be accessible in the browser build

#### 4. Session & Security
```bash
SESSION_SECRET=your-random-secret-here-change-in-production
COOKIE_SECURE=true
```
Generate a secure random string for `SESSION_SECRET` (32+ characters)

#### 5. Application URL
```bash
APP_URL=https://your-domain.vercel.app
VITE_APP_URL=https://your-domain.vercel.app
```
**⚠️ CRITICAL**: Use your actual Vercel domain, NOT localhost
This is used for email verification links and OAuth redirects

#### 6. AI Integration (Yandex Cloud)
```bash
YANDEX_CLOUD_API_KEY=your-yandex-api-key
YANDEX_CLOUD_PROJECT_FOLDER_ID=your-yandex-folder-id
YANDEX_CLOUD_BASE_URL=https://rest-assistant.api.cloud.yandex.net/v1
YANDEX_PROMPT_ID=your-yandex-prompt-id
YANDEX_TIMEOUT_MS=90000
```

#### 7. Email Configuration (SMTP)
```bash
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=your-email@yandex.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=Your App <your-email@yandex.com>
```
For Yandex: Generate APP PASSWORD at https://id.yandex.ru/security → App passwords

#### 8. Application Configuration
```bash
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
LOG_LEVEL=info
LOG_PRETTY=false
SHUTDOWN_TIMEOUT_MS=10000
REQUEST_LOG_SAMPLE=0.1
```

#### 9. Owner Contact (Optional)
```bash
OWNER_TELEGRAM=@YourTelegramHandle
```

---

## 🔍 Environment Variable Prefixes

### Vite Environment Variables (Client-side)
- **Prefix Required**: `VITE_`
- **Access**: `import.meta.env.VITE_*`
- **Exposed**: ✅ Available in browser bundle
- **Security**: ⚠️ Never put secrets here (visible in client code)

### Server Environment Variables
- **Prefix**: None
- **Access**: `process.env.*`
- **Exposed**: ❌ Server-side only
- **Security**: ✅ Safe for secrets (not exposed to client)

### Example
```typescript
// ✅ CORRECT - Client-side
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ❌ WRONG - Won't work on client
const supabaseUrl = process.env.SUPABASE_URL; // undefined in browser

// ✅ CORRECT - Server-side
const serviceRoleKey = process.env.DATABASE_FILE_STORAGE_KEY; // Secret, server only
```

---

## 🧪 Testing Deployment

### 1. Check Build Locally
```bash
npm run build
npm run start
# Visit http://localhost:5000
```

### 2. Verify Environment Variables
The app will log validation errors if required variables are missing:
```
[ENV] Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
[ENV] Please add these variables in Vercel Project Settings → Environment Variables
```

### 3. Test Production Build
After deploying to Vercel:
- ✅ Homepage `/` loads without 404
- ✅ Direct navigation to routes works (e.g., `/auth`, `/app/courses`, `/curator`)
- ✅ Browser refresh on any route doesn't show 404
- ✅ Supabase authentication works
- ✅ API requests succeed
- ✅ No console errors about missing environment variables

### 4. Common Issues

#### Issue: 404 on all routes
**Fix**: Ensure `vercel.json` exists and `dist/index.cjs` was built correctly

#### Issue: "Missing environment variables" in console
**Fix**: Add all required `VITE_*` variables in Vercel Project Settings

#### Issue: Supabase auth fails
**Fix**: 
1. Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
2. Verify values match Supabase Dashboard → Settings → API
3. Check `APP_URL` and `VITE_APP_URL` point to your Vercel domain

#### Issue: Email verification links don't work
**Fix**: 
1. Set `APP_URL` and `VITE_APP_URL` to your production domain (not localhost)
2. Update Supabase redirect URLs in Dashboard → Authentication → URL Configuration

#### Issue: Database connection fails
**Fix**: 
1. Check `DATABASE_URL` is set correctly
2. Ensure Supabase allows connections from Vercel IPs
3. Verify SSL mode is configured: `?sslmode=require`

---

## 📁 File Structure

```
/
├── vercel.json                          # ✅ NEW - Vercel configuration
├── client/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── supabase.ts             # ✅ UPDATED - Better error handling
│   │   │   └── env-validation.ts       # ✅ NEW - Environment validation
│   │   ├── hooks/
│   │   │   └── use-auth.ts             # ✅ UPDATED - Use env helpers
│   │   └── App.tsx                     # Wouter routing (no changes)
│   └── index.html
├── server/
│   ├── index.ts                        # Express server
│   ├── routes.ts                       # API routes
│   ├── static.ts                       # SPA fallback (already working)
│   └── supabase-*.ts                   # Supabase server integrations
├── script/
│   └── build.ts                        # Build script (client + server)
└── dist/                               # Build output
    ├── index.cjs                       # Bundled Express server
    └── public/                         # Vite build output
        ├── index.html
        └── assets/
```

---

## 🎯 Deployment Checklist

### Before First Deploy
- [x] `vercel.json` created
- [x] Environment validation added
- [x] Supabase client improved
- [ ] All environment variables added to Vercel
- [ ] Supabase redirect URLs updated
- [ ] Domain configured (if using custom domain)

### After Deploy
- [ ] Test homepage loads
- [ ] Test direct route navigation
- [ ] Test browser refresh on routes
- [ ] Test authentication flow
- [ ] Test email verification
- [ ] Check browser console for errors
- [ ] Verify no environment variable warnings

---

## 🔄 Updating Deployment

### Code Changes
1. Push to GitHub branch
2. Vercel automatically rebuilds and deploys
3. Check deployment logs for build errors

### Environment Variable Changes
1. Go to Vercel Project Settings → Environment Variables
2. Update the variable
3. Redeploy (automatic on next push, or manual redeploy)

---

## 🆘 Support

### Debugging Steps
1. Check Vercel deployment logs for build errors
2. Check browser console for runtime errors
3. Verify all environment variables are set correctly
4. Test locally with production build: `npm run build && npm run start`

### Vercel Logs
```bash
# View deployment logs
vercel logs <deployment-url>

# View function logs (for serverless debugging)
vercel logs <deployment-url> --follow
```

---

## ✨ Summary

### What Changed
- ✅ Created `vercel.json` for Node.js deployment
- ✅ Added environment variable validation
- ✅ Improved error handling for Supabase
- ✅ Fixed environment variable usage
- ✅ **NO DESIGN CHANGES** - only infrastructure fixes

### What You Need to Do
1. **Add all environment variables** in Vercel Project Settings
2. **Update Supabase redirect URLs** to your Vercel domain
3. **Deploy** - Vercel will automatically detect the configuration
4. **Test** - Verify all routes work and no console errors

---

## 📧 Environment Variables Quick Reference

Copy this template to Vercel Project Settings → Environment Variables:

```bash
# Database
DATABASE_URL=

# Supabase (Backend)
DATABASE_FILE_STORAGE_URL=
DATABASE_FILE_STORAGE_KEY=
SUPABASE_ANON_KEY=

# Supabase (Frontend - VITE_ prefix)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# App URLs
APP_URL=
VITE_APP_URL=

# Security
SESSION_SECRET=
COOKIE_SECURE=true

# AI
YANDEX_CLOUD_API_KEY=
YANDEX_CLOUD_PROJECT_FOLDER_ID=
YANDEX_CLOUD_BASE_URL=https://rest-assistant.api.cloud.yandex.net/v1
YANDEX_PROMPT_ID=
YANDEX_TIMEOUT_MS=90000

# Email
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

# System
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
LOG_LEVEL=info
LOG_PRETTY=false
SHUTDOWN_TIMEOUT_MS=10000
REQUEST_LOG_SAMPLE=0.1
```

---

**Ready to deploy! 🚀**
