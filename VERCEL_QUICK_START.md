# 🚀 Vercel Deployment - Quick Start

## ⚡ TL;DR

Your app had **404 errors on Vercel** because it's a **fullstack Express app**, not a static site.

**Fixed by adding:** `vercel.json` + environment validation

**What you need to do:** 
1. Add environment variables to Vercel
2. Update Supabase redirect URLs
3. Push to GitHub

---

## 📊 What Was Wrong

```diff
- Vercel thought this was a static SPA
- Tried to serve files directly from dist/
- No server running = 404 on all routes
```

## ✅ What Was Fixed

```diff
+ Created vercel.json (tells Vercel to run Node.js server)
+ Added environment validation (clear error messages)
+ Updated Supabase client (better error handling)
+ Created documentation (you're reading it!)
```

---

## 🎯 3-Step Deploy

### Step 1: Configure Vercel Project

Go to: **Vercel Dashboard → Your Project → Settings**

```
Build Command:       npm run build
Output Directory:    dist
Install Command:     npm ci
Node.js Version:     20.x
```

### Step 2: Add Environment Variables

Go to: **Settings → Environment Variables**

Copy from `.env.vercel.template` or use this:

```bash
# Database
DATABASE_URL=postgresql://...

# Supabase (Backend)
DATABASE_FILE_STORAGE_URL=https://xxx.supabase.co
DATABASE_FILE_STORAGE_KEY=xxx_service_role_key
SUPABASE_ANON_KEY=xxx_anon_key

# Supabase (Frontend - VITE_ prefix REQUIRED!)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx_anon_key

# App URLs (use your Vercel domain!)
APP_URL=https://your-app.vercel.app
VITE_APP_URL=https://your-app.vercel.app

# Security
SESSION_SECRET=random-32-char-string
COOKIE_SECURE=true

# AI, Email, etc. (see .env.vercel.template)
```

⚠️ **IMPORTANT:**
- Frontend vars MUST have `VITE_` prefix
- Use your **Vercel domain** for APP_URL, NOT localhost
- Add variables for **Preview** AND **Production**

### Step 3: Update Supabase + Deploy

1. **Supabase Dashboard** → Authentication → URL Configuration
   - Add redirect: `https://your-app.vercel.app/auth/callback`

2. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Fix Vercel deployment"
   git push
   ```

3. **Wait for Vercel** to build and deploy automatically

---

## ✅ Verify It Works

After deploy, check these:

| Test | Expected Result |
|------|----------------|
| Visit `/` | ✅ Homepage loads |
| Visit `/auth` | ✅ Auth page loads |
| Visit `/app/courses` | ✅ Courses page (or redirect to login) |
| Visit `/curator` | ✅ Curator page (or redirect) |
| Press F5 on any page | ✅ No 404 error |
| Login | ✅ Works |
| Email verification | ✅ Link works |
| Browser console | ✅ No env errors |

---

## 🐛 Common Issues

### ❌ Still getting 404

**Check:**
1. Is `vercel.json` committed to Git?
2. Did Vercel build succeed? (check deployment logs)
3. Is `dist/index.cjs` created during build?

### ❌ "Missing environment variables"

**Check:**
1. Did you add `VITE_SUPABASE_URL`?
2. Did you add `VITE_SUPABASE_ANON_KEY`?
3. Are variable names spelled correctly?

### ❌ Auth doesn't work

**Check:**
1. `VITE_SUPABASE_URL` matches Supabase Dashboard?
2. `VITE_SUPABASE_ANON_KEY` matches Supabase Dashboard?
3. Redirect URL in Supabase includes your Vercel domain?

### ❌ Email links don't work

**Check:**
1. `APP_URL` = `https://your-app.vercel.app` (not localhost)
2. `VITE_APP_URL` = same as above
3. Supabase redirect URLs updated?

---

## 📚 More Details

- **Full Guide**: `VERCEL_DEPLOYMENT_GUIDE.md` (comprehensive)
- **Summary**: `VERCEL_FIX_SUMMARY.md` (Russian)
- **Technical**: `DEPLOYMENT_FIX_REPORT.md` (deep dive)
- **Checklist**: `DEPLOYMENT_CHECKLIST.md` (step-by-step)
- **Env Template**: `.env.vercel.template` (all variables)

---

## 📋 Files Changed

### New Files ✨
```
✅ vercel.json                          ← Vercel config
✅ client/src/lib/env-validation.ts    ← Environment validation
✅ VERCEL_DEPLOYMENT_GUIDE.md          ← Full guide
✅ VERCEL_FIX_SUMMARY.md               ← Russian summary
✅ DEPLOYMENT_FIX_REPORT.md            ← Technical report
✅ DEPLOYMENT_CHECKLIST.md             ← Checklist
✅ .env.vercel.template                ← Env template
✅ VERCEL_QUICK_START.md               ← This file
```

### Updated Files 🔄
```
🔄 client/src/lib/supabase.ts          ← Better validation
🔄 client/src/hooks/use-auth.ts        ← Using env helpers
```

### No Changes ❌
```
❌ Design / UI
❌ Components
❌ Routing logic
❌ API endpoints
❌ Database schema
```

---

## 🎉 You're Ready!

1. ✅ Fix applied
2. ⏳ Add environment variables to Vercel
3. ⏳ Update Supabase redirect URLs
4. ⏳ Push to GitHub
5. ✅ Deploy automatically

**Questions?** Check the troubleshooting sections in the detailed guides.

---

**Status:** 🟢 Ready to Deploy
