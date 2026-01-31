# ADAPT AI - Complete Deployment Plan

## Executive Summary

This document provides a comprehensive deployment plan to fix all 404 errors and ensure proper Supabase integration for the ADAPT AI application.

## Critical Issues Identified

### 1. Missing Pages Directory
**SEVERITY: CRITICAL - Blocking All Routes**

**Problem:**
- App.tsx imports 11 page components from `@/pages/*`
- The `client/src/pages/` directory does not exist
- All routes return 404 errors

**Missing Pages:**
```
client/src/pages/
├── landing.tsx              # Homepage
├── auth.tsx                 # Login/Register
├── auth-callback.tsx        # Supabase email verification callback
├── not-found.tsx            # 404 page
├── employee/
│   ├── courses.tsx          # Employee course list
│   ├── profile.tsx          # Employee profile
│   └── player.tsx           # Course player
└── curator/
    ├── library.tsx          # Curator course library
    ├── course-details.tsx   # Course details/editor
    ├── analytics.tsx        # Course analytics
    └── profile.tsx          # Curator profile
```

**Impact:**
- Application completely non-functional
- All routes fail to load
- Build will fail due to missing imports

**Solution Required:**
- Create all 11 missing page components
- Implement proper UI for each page
- Ensure routing works correctly

---

### 2. Environment Configuration Issues
**SEVERITY: HIGH**

**Problem:**
- `.env: not found` errors in logs
- No environment validation
- Missing development environment file

**Fixed:**
- Created `/.env.development` template
- Created `/scripts/check-env.ts` validation script
- Added `npm run check:env` command
- Updated Supabase client with validation

**Required Actions:**
1. Copy `.env.example` to `.env`
2. Fill in all required values
3. Run `npm run check:env` to validate

---

### 3. Vercel Deployment Configuration
**SEVERITY: HIGH**

**Problem:**
- Missing `vercel.json` configuration
- Vercel treats fullstack Express app as static SPA
- No routing configuration for Node.js server

**Fixed:**
- Created `/vercel.json` with proper configuration
- Configured Node.js runtime
- Set up routing to Express server

**Required Actions:**
1. Add environment variables in Vercel dashboard
2. Configure build settings
3. Deploy

---

## Deployment Checklist

### Phase 1: Fix Critical Issues (BLOCKING)

- [ ] **1.1 Create Missing Pages**
  ```bash
  # These pages MUST be created:
  client/src/pages/landing.tsx
  client/src/pages/auth.tsx
  client/src/pages/auth-callback.tsx
  client/src/pages/not-found.tsx
  client/src/pages/employee/courses.tsx
  client/src/pages/employee/profile.tsx
  client/src/pages/employee/player.tsx
  client/src/pages/curator/library.tsx
  client/src/pages/curator/course-details.tsx
  client/src/pages/curator/analytics.tsx
  client/src/pages/curator/profile.tsx
  ```

- [ ] **1.2 Verify Page Imports**
  ```bash
  # Ensure all imports in App.tsx resolve correctly
  npm run check
  ```

### Phase 2: Environment Setup

- [ ] **2.1 Local Development**
  ```bash
  # Copy environment template
  cp .env.example .env
  
  # Edit .env with your credentials
  # Required variables:
  # - DATABASE_URL
  # - SUPABASE_ANON_KEY
  # - VITE_SUPABASE_URL
  # - VITE_SUPABASE_ANON_KEY
  # - SESSION_SECRET
  # - APP_URL
  # - VITE_APP_URL
  
  # Validate environment
  npm run check:env
  ```

- [ ] **2.2 Database Setup**
  ```bash
  # Run database migrations
  npm run db:push
  
  # Verify database connection
  # Check that tables exist in Supabase dashboard
  ```

- [ ] **2.3 Supabase Configuration**
  - [ ] Add authentication providers (Email/Magic Link)
  - [ ] Configure redirect URLs:
    - Development: `http://localhost:5000/auth/callback`
    - Production: `https://your-app.vercel.app/auth/callback`
  - [ ] Enable Row Level Security (RLS) policies
  - [ ] Configure storage buckets (if using Supabase Storage)

### Phase 3: Local Testing

- [ ] **3.1 Start Development Server**
  ```bash
  npm run dev
  ```

- [ ] **3.2 Test All Routes**
  - [ ] `/` - Landing page loads
  - [ ] `/auth` - Auth page loads
  - [ ] `/auth/callback` - Callback handler works
  - [ ] `/app/courses` - Employee courses (requires auth)
  - [ ] `/app/profile` - Employee profile (requires auth)
  - [ ] `/app/player/:trackId` - Course player (requires auth)
  - [ ] `/curator` - Curator library (requires curator role)
  - [ ] `/curator/course/:id` - Course details (requires curator role)
  - [ ] `/curator/analytics` - Analytics (requires curator role)
  - [ ] `/curator/profile` - Curator profile (requires curator role)
  - [ ] Invalid route - Shows 404 page

- [ ] **3.3 Test Authentication Flow**
  - [ ] Register new user
  - [ ] Verify email link works
  - [ ] Login with credentials
  - [ ] Session persists after refresh
  - [ ] Logout works
  - [ ] Protected routes redirect to /auth when not logged in

- [ ] **3.4 Test Role-Based Access**
  - [ ] Employee can only access /app/* routes
  - [ ] Curator can only access /curator/* routes
  - [ ] Role switching works correctly

### Phase 4: Vercel Deployment

- [ ] **4.1 Vercel Project Setup**
  ```
  Framework Preset: Other
  Build Command: npm run build
  Output Directory: dist
  Install Command: npm ci
  Node.js Version: 20.x
  ```

- [ ] **4.2 Environment Variables**
  Add all variables from `.env.vercel.template`:
  ```bash
  # Required for Vercel:
  DATABASE_URL=postgresql://...
  DATABASE_FILE_STORAGE_URL=https://xxx.supabase.co
  DATABASE_FILE_STORAGE_KEY=service_role_key
  SUPABASE_ANON_KEY=anon_key
  VITE_SUPABASE_URL=https://xxx.supabase.co
  VITE_SUPABASE_ANON_KEY=anon_key
  APP_URL=https://your-app.vercel.app
  VITE_APP_URL=https://your-app.vercel.app
  SESSION_SECRET=random-32-chars
  COOKIE_SECURE=true
  # ... (see .env.vercel.template for full list)
  ```

- [ ] **4.3 Update Supabase Redirect URLs**
  - Add production URL to Supabase authentication settings
  - Format: `https://your-app.vercel.app/auth/callback`

- [ ] **4.4 Deploy to Vercel**
  ```bash
  git add .
  git commit -m "Fix deployment configuration and add missing pages"
  git push
  ```

- [ ] **4.5 Verify Deployment**
  - [ ] Homepage loads without errors
  - [ ] All routes work
  - [ ] Authentication flow works
  - [ ] No 404 errors
  - [ ] No console errors

### Phase 5: Post-Deployment Validation

- [ ] **5.1 Smoke Tests**
  - [ ] Create test user account
  - [ ] Upload test course (for curators)
  - [ ] Enroll in course (for employees)
  - [ ] Complete course module
  - [ ] View analytics

- [ ] **5.2 Performance Check**
  - [ ] Page load times < 3s
  - [ ] Time to Interactive < 5s
  - [ ] No memory leaks
  - [ ] No infinite loops

- [ ] **5.3 Error Monitoring**
  - [ ] Check Vercel logs for errors
  - [ ] Monitor Supabase logs
  - [ ] Check browser console for errors

---

## Troubleshooting Guide

### Issue: "Cannot find module '@/pages/...'"

**Cause:** Pages directory doesn't exist  
**Solution:** Create all missing page components (see Phase 1.1)

### Issue: ".env: not found"

**Cause:** No .env file in project root  
**Solution:**
```bash
cp .env.example .env
# Edit .env with your credentials
npm run check:env
```

### Issue: "Unauthorized" errors

**Cause:** Supabase environment variables not set  
**Solution:**
1. Check `SUPABASE_ANON_KEY` is set
2. Check `VITE_SUPABASE_URL` matches your Supabase project
3. Run `npm run check:env`

### Issue: Email verification links don't work

**Cause:** Incorrect `APP_URL` or Supabase redirect URL  
**Solution:**
1. Set `APP_URL` to your actual domain (not localhost in production)
2. Add redirect URL in Supabase dashboard
3. Ensure `APP_URL` matches redirect URL exactly

### Issue: 404 on page refresh

**Cause:** Missing SPA fallback routing  
**Solution:** Already fixed in `vercel.json` - Express server handles all routes

### Issue: "Course limit reached" for trial users

**Expected behavior:** Trial users can only create 1 course  
**Solution:** Enter promo code or upgrade plan

---

## Architecture Overview

### Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS
- **Router:** Wouter (lightweight React router)
- **Backend:** Express.js + Node.js
- **Database:** PostgreSQL (via Supabase)
- **ORM:** Drizzle ORM
- **Auth:** Supabase Auth + JWT
- **Deployment:** Vercel (Node.js runtime)

### Routing Architecture
```
Client (Browser)
    ↓
Vercel Edge Network
    ↓
Express.js Server (Node.js runtime)
    ├── API Routes (/api/*)
    ├── Static Files (/assets/*)
    └── SPA Fallback (all other routes)
        ↓
    React App (wouter routing)
        ├── Public Routes (/,  /auth, /auth/callback)
        ├── Employee Routes (/app/*)
        └── Curator Routes (/curator/*)
```

### Authentication Flow
```
1. User submits email/password
2. Supabase Auth creates user
3. Sends verification email
4. User clicks link → /auth/callback
5. Frontend exchanges code for session
6. Backend validates JWT
7. Creates server session
8. Redirects to appropriate dashboard
```

---

## Next Steps

1. **IMMEDIATE:** Create all missing page components (Phase 1)
2. **URGENT:** Set up local environment (Phase 2)
3. **HIGH:** Test locally (Phase 3)
4. **MEDIUM:** Deploy to Vercel (Phase 4)
5. **LOW:** Monitor and optimize (Phase 5)

---

## Support Resources

- **Vercel Documentation:** Created in `/VERCEL_DEPLOYMENT_GUIDE.md`
- **Environment Setup:** See `/.env.vercel.template`
- **Quick Start:** See `/VERCEL_QUICK_START.md`
- **Russian Guide:** See `/БЫСТРЫЙ_СТАРТ.md`

---

## Timeline Estimate

- Phase 1 (Critical): 2-4 hours (create all pages)
- Phase 2 (Environment): 30 minutes
- Phase 3 (Testing): 1-2 hours
- Phase 4 (Deployment): 30 minutes
- Phase 5 (Validation): 1 hour

**Total:** 5-8 hours to complete deployment

---

## Status: IN PROGRESS

### Completed:
- Environment validation system
- Vercel configuration
- Supabase client integration
- Documentation

### In Progress:
- Creating missing page components

### Blocked:
- Local testing (waiting for pages)
- Deployment (waiting for pages)

---

**Last Updated:** $(date)
**Status:** CRITICAL - Missing pages blocking all functionality
**Priority:** P0 - Must be fixed before deployment
