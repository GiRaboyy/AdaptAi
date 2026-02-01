# Fix Vercel Deployment - Serverless Migration

## Problem Statement

**Current State:**
- Local development works perfectly (`npm run dev`)
- Vercel deployment shows white screen and 404 errors
- Frontend static files deploy successfully
- Backend Express/Node API returns 404 on all `/api/*` routes
- Root issue: Attempting to deploy Express server as monolithic Node application on Vercel

**Root Cause:**
The current `vercel.json` attempts to route requests to `dist/index.cjs`, which is a long-running Express server designed for traditional hosting. Vercel's architecture requires serverless functions that handle individual requests, not persistent servers that call `listen()`.

**Goal:**
Transform the Express application to work as Vercel Serverless Functions while maintaining full local development compatibility.

---

## Definition of Done

### Production (Vercel)
1. **SPA Routing:** `GET /` serves the React SPA without white screen
2. **Client Routes:** All SPA routes (`/login`, `/dashboard`, `/courses/123`) serve `index.html` without 404
3. **Health Check:** `GET /api/health` returns 200 with `{ ok: true, nodeEnv: "production" }`
4. **Authentication Endpoints:** `POST /api/login` and `POST /api/register` respond correctly (not 404)
5. **Static Assets:** All `/assets/*` files serve correctly from `dist/public/`

### Development (Local)
1. **Dev Server:** `npm run dev` continues to work as before
2. **Hot Reload:** Vite HMR and backend changes work normally
3. **API Routes:** All `/api/*` endpoints function locally
4. **Static Serving:** Frontend served by Vite dev server in development

### Code Quality
1. **Server Separation:** Express app logic separated from server lifecycle (`listen()`)
2. **Environment Handling:** Vercel environment variables loaded correctly
3. **Session Management:** Express sessions work on Vercel (with proper proxy trust and cookie settings)
4. **No Breaking Changes:** Existing API behavior unchanged

---

## Architecture Changes

### Current Architecture
```mermaid
graph TB
    subgraph "Current (Broken on Vercel)"
        A[Vercel] --> B[dist/index.cjs]
        B --> C[Express Server with listen()]
        C --> D[API Routes]
        C --> E[Static Files]
    end
```

**Problem:** Vercel cannot execute `httpServer.listen()` in serverless functions.

### Target Architecture
```mermaid
graph TB
    subgraph "Target (Serverless)"
        V[Vercel Request] --> R{Route Type?}
        R -->|/api/**| F[api/[...path].ts]
        R -->|/assets/**| S1[Static: dist/public/assets]
        R -->|/*| S2[Static: dist/public/index.html]
        
        F --> APP[Express App (no listen)]
        APP --> M[Middleware Chain]
        M --> AR[API Routes]
    end
    
    subgraph "Local Development"
        L[npm run dev] --> SI[server/index.ts]
        SI --> APP2[createApp()]
        SI --> LS[app.listen()]
        APP2 --> V2[Vite Dev Server]
    end
```

---

## Implementation Plan

### A. Server Refactoring: Separate App from Lifecycle

**Objective:** Extract Express app configuration from server lifecycle management.

#### Create `server/app.ts`

This file exports a factory function that creates and configures the Express app without starting the server.

**Responsibilities:**
- Configure Express middleware (JSON parser, URL-encoded, request ID, logging)
- Set up authentication middleware (Supabase JWT validation)
- Register all API routes
- Set up error handling middleware
- Configure session management with proper trust proxy and cookie settings

**Key Requirements:**
- **No `listen()` call** - the app must be configurable but not started
- **Idempotent** - can be called multiple times (important for serverless cold starts)
- **Environment-aware** - handle both development and production configurations
- **Stateless** - no global state that persists between invocations

**Session Configuration for Vercel:**
```
Session Store: connect-pg-simple (PostgreSQL-backed)
Trust Proxy: app.set('trust proxy', 1)
Cookie Settings:
  - secure: process.env.NODE_ENV === 'production'
  - sameSite: 'lax'
  - maxAge: 30 days
  - httpOnly: true
```

**Error Handling:**
- If `DATABASE_URL` or `SESSION_SECRET` missing in production, log warnings but don't crash
- Return 500 with message "Server configuration incomplete" for requests requiring auth

**Health Check Endpoint:**
Add `/api/health` route that returns:
```
{
  "ok": true,
  "nodeEnv": process.env.NODE_ENV,
  "hasDatabase": Boolean(process.env.DATABASE_URL),
  "hasSessionSecret": Boolean(process.env.SESSION_SECRET),
  "timestamp": ISO8601 string
}
```

#### Update `server/index.ts`

Transform this file to be the local development entry point only.

**Changes:**
1. Import `createApp()` from `./app`
2. Call `createApp()` to get Express app
3. Keep all server lifecycle code (httpServer, graceful shutdown, signal handlers)
4. Keep Vite dev server integration for development mode
5. Keep static file serving for production mode (though not used on Vercel)
6. Keep `app.listen()` call with port/host configuration

**Conditional Logic:**
- Development mode: Set up Vite middleware after routes
- Production mode: Set up static file serving after routes

**No Breaking Changes:**
- `npm run dev` must continue to work identically
- `npm start` should still work for local production testing

---

### B. Vercel Serverless Function: API Handler

**Objective:** Create a Vercel serverless function that routes `/api/**` requests to Express.

#### Create `api/[...path].ts`

This is a catch-all route handler for Vercel that forwards all API requests to Express.

**Location:** `api/[...path].ts` (Vercel File System Routing convention)

**Implementation Strategy:**
```
1. Import createApp from server/app
2. Create Express app instance (singleton pattern at module scope)
3. Export default async handler function
4. Handler receives VercelRequest and VercelResponse
5. Forward req/res to Express app
6. Return response
```

**Type Safety:**
- Install `@vercel/node` as dev dependency
- Use `VercelRequest` and `VercelResponse` types
- Handle TypeScript compilation for Vercel's Node.js runtime

**Singleton Pattern:**
The Express app should be instantiated once per serverless function instance (not per request) to optimize cold start performance:
```
const app = createApp(); // Module-level singleton

export default async function handler(req, res) {
  return app(req, res);
}
```

**Error Handling:**
- Catch any errors from Express app
- Return 500 with generic error message
- Log errors to Vercel logs (console.error)

**Timeout Considerations:**
- Vercel default timeout is 10 seconds (can be increased to 60s for Pro)
- Long-running operations (course generation) may need optimization or streaming responses

---

### C. Vercel Configuration: SPA + Serverless Routing

**Objective:** Configure Vercel to serve static files and route API requests correctly.

#### Update `vercel.json`

Replace the current Vercel v2 builds configuration with a simpler routes-based approach.

**Key Principles:**
1. **Filesystem Routes First:** Let Vercel serve static assets directly
2. **API Routes:** Forward `/api/**` to serverless function
3. **SPA Fallback:** All other routes serve `index.html`

**Route Precedence (Order Matters):**
```
1. { "handle": "filesystem" }           // Serve existing files
2. { "src": "/(.*)", "dest": "/index.html" }  // SPA fallback for all other routes
```

**Build Configuration:**
```
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "framework": null
}
```

**Why Remove `builds` Array:**
- Vercel's File System Routing automatically detects `api/` directory
- No need to explicitly define `@vercel/node` and `@vercel/static` builds
- Simpler configuration, fewer opportunities for misconfiguration

**Environment Variables:**
Vercel will read environment variables from project settings (Vercel Dashboard), not from `.env-prod` file. The build process will have access to:
- `DATABASE_URL`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `YANDEX_*` variables
- Any other secrets configured in Vercel dashboard

---

### D. Build Process: Output Structure

**Objective:** Ensure build process creates correct directory structure for Vercel.

#### Verify `script/build.ts`

Current build script creates:
```
dist/
  index.cjs          # Express server bundle (not used on Vercel)
  public/            # Vite output
    index.html
    assets/
      *.js
      *.css
```

**Required Changes:**
None to `script/build.ts` itself, but ensure:
1. `vite build` creates `dist/public/index.html`
2. All static assets go to `dist/public/assets/`
3. The `dist/index.cjs` file is still generated (for local `npm start`)

**Vercel Build Command:**
- Command: `npm run build`
- Vercel executes this in CI environment
- Environment variables from Vercel dashboard are available during build

**Output Verification:**
After build completes, verify:
- `dist/public/index.html` exists
- `dist/public/assets/` contains JS/CSS bundles
- No absolute paths in HTML (all assets use relative paths)

---

### E. Vite Configuration: Remove Replit Plugins from Production

**Objective:** Clean up production builds by removing development-only plugins.

#### Update `vite.config.ts`

**Current Issue:**
`runtimeErrorOverlay()` is always active, even in production builds. This plugin is only useful in Replit development environment.

**Required Changes:**
1. Wrap `runtimeErrorOverlay()` in conditional logic
2. Only include when `process.env.REPL_ID` exists OR `NODE_ENV === 'development'`
3. Ensure `await import()` dynamic imports don't break on Vercel

**Conditional Plugin Loading:**
```
plugins: [
  react(),
  ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID 
    ? [runtimeErrorOverlay()] 
    : []),
  ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID
    ? [await import('@replit/vite-plugin-cartographer').then(m => m.cartographer())]
    : []),
  // ... other conditional Replit plugins
]
```

**Rationale:**
- Reduces bundle size in production
- Avoids potential conflicts with Vercel's serverless runtime
- Cleaner production builds

**Build Safety:**
- Verify that conditional imports don't cause build failures
- Test production build locally: `NODE_ENV=production npm run build`

---

### F. Session & Cookie Configuration for Serverless

**Objective:** Ensure Express sessions work correctly on Vercel's serverless infrastructure.

#### Session Store Configuration

**PostgreSQL-Backed Sessions:**
The project already uses `connect-pg-simple` which is ideal for serverless:
- Sessions persist in PostgreSQL database
- Multiple serverless instances share session state
- No memory store (which wouldn't work in serverless)

**Trust Proxy Setting:**
Vercel deploys behind a reverse proxy, so Express must trust the `X-Forwarded-*` headers:
```
app.set('trust proxy', 1)
```

**Cookie Configuration:**
```
{
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
  httpOnly: true,                                 // Prevent XSS
  sameSite: 'lax',                                // CSRF protection
  maxAge: 30 * 24 * 60 * 60 * 1000               // 30 days
}
```

**Environment Variable Validation:**
In `server/app.ts`, add checks:
```
if (process.env.NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL) {
    console.warn('[Session] Missing DATABASE_URL in production');
  }
  if (!process.env.SESSION_SECRET) {
    console.warn('[Session] Missing SESSION_SECRET in production');
  }
}
```

**Session Store Initialization:**
```
If DATABASE_URL exists:
  Use connect-pg-simple with PostgreSQL
Else:
  Use memory store (development only)
  Log warning if in production
```

---

### G. Environment Variables: Vercel Dashboard Configuration

**Objective:** Document which environment variables must be set in Vercel dashboard.

#### Required Environment Variables

These must be configured in Vercel Project Settings → Environment Variables:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `DATABASE_URL` | PostgreSQL connection for Drizzle ORM and sessions | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Express session encryption key | Random 64-char string |
| `SUPABASE_URL` | Supabase project URL for auth | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` |
| `YANDEX_PROMPT_ID` | Yandex AI prompt identifier | From Yandex Cloud console |
| `YANDEX_FOLDER_ID` | Yandex Cloud folder ID | From Yandex Cloud console |
| `YANDEX_API_KEY` | Yandex AI API authentication | From Yandex Cloud console |
| `NODE_ENV` | Runtime environment (auto-set by Vercel) | `production` |

**How to Set:**
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add each variable for "Production" environment
3. Source values from working local `.env` file or Supabase/Yandex dashboards
4. DO NOT commit secrets to Git
5. Re-deploy after adding/updating variables

**Validation:**
Test that variables are loaded correctly by checking `/api/health` response after deployment.

---

### H. Static Asset Serving: Fix "Download File" Issue

**Objective:** Ensure `index.html` is served as HTML, not downloaded as a file.

#### Root Cause Analysis

If `index.html` downloads instead of rendering, possible causes:
1. Incorrect `Content-Type` header (should be `text/html; charset=utf-8`)
2. Wrong `Content-Disposition` header (should be absent or `inline`)
3. Vercel output directory misconfiguration

#### Verification Steps

**Check Vercel Configuration:**
- Output Directory must be `dist/public`
- `index.html` must exist at `dist/public/index.html` (not nested deeper)

**Check HTML Meta Tags:**
Ensure `client/index.html` has:
```
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

**Check Vercel Routing:**
The SPA fallback route `{ "src": "/(.*)", "dest": "/index.html" }` should automatically serve HTML with correct content type.

**Test After Deploy:**
1. Open browser DevTools → Network tab
2. Navigate to deployed URL
3. Check response headers for root request:
   - `Content-Type: text/html; charset=utf-8`
   - No `Content-Disposition` header
   - Status: 200

---

## File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `server/app.ts` | **CREATE** | Express app factory without server lifecycle |
| `server/index.ts` | **MODIFY** | Use createApp(), keep listen() for local dev |
| `api/[...path].ts` | **CREATE** | Vercel serverless function for API routes |
| `vercel.json` | **REPLACE** | Simplified routing configuration |
| `vite.config.ts` | **MODIFY** | Conditional Replit plugins (dev only) |
| `package.json` | **MODIFY** | Add `@vercel/node` to devDependencies |

---

## Testing Checklist

### Local Development Testing
```
Test Case: Local dev server starts
Command: npm run dev
Expected: Server runs on port 5000, Vite HMR works
Verify: Open http://localhost:5000, check API routes

Test Case: Production build locally
Command: npm run build
Expected: dist/public/index.html created, no errors
Verify: Check dist/ directory structure

Test Case: Local production server
Command: npm start
Expected: Server serves from dist/public
Verify: Open http://localhost:5000, test API
```

### Vercel Deployment Testing
```
Test Case: Deploy to Vercel
Action: Push to main branch or run vercel deploy
Expected: Build succeeds, deployment URL provided
Verify: Check Vercel logs for build errors

Test Case: Root route serves SPA
Request: GET https://your-project.vercel.app/
Expected: HTML page loads, no white screen, no download
Verify: View source shows React app HTML

Test Case: Client-side routes work
Request: GET https://your-project.vercel.app/login
Expected: HTML page loads (same as root)
Verify: React Router handles client-side navigation

Test Case: Health check endpoint
Request: GET https://your-project.vercel.app/api/health
Expected: 200 status, JSON response { ok: true, nodeEnv: "production" }
Verify: Check hasDatabase and hasSessionSecret are true

Test Case: Authentication endpoints
Request: POST https://your-project.vercel.app/api/login
Expected: Not 404 (should return 400 or 401 without valid credentials)
Verify: Error response is structured JSON

Test Case: Static assets load
Request: GET https://your-project.vercel.app/assets/index-[hash].js
Expected: 200 status, JavaScript content
Verify: Network tab shows all assets loaded
```

---

## Rollback Plan

If deployment fails or causes issues:

1. **Immediate Rollback:** Use Vercel dashboard to revert to previous working deployment
2. **Local Testing:** Test changes locally before deploying: `npm run build && npm start`
3. **Staged Rollout:** Deploy to Vercel preview environment first (push to feature branch)
4. **Monitoring:** Check Vercel logs and `/api/health` endpoint after each change

**Critical Files Backup:**
Before starting, save copies of:
- `server/index.ts` (current version)
- `vercel.json` (current version)

---

## Vercel Dashboard Configuration

After code changes are deployed, configure these settings in Vercel dashboard:

### Build & Development Settings
```
Framework Preset: Other
Build Command: npm run build
Output Directory: dist/public
Install Command: npm install
Node.js Version: 18.x (or latest LTS)
```

### Root Directory
```
Root Directory: ./
```

### Environment Variables
Set all variables listed in section G (Environment Variables) above.

### Function Configuration
```
Max Duration: 60 seconds (for course generation endpoints)
Memory: 1024 MB (default)
```

---

## Known Limitations

1. **Long-Running Operations:** Course generation (AI-based) may take 60+ seconds, which exceeds Vercel's default function timeout. Consider:
   - Upgrading to Vercel Pro for longer timeouts
   - Implementing async job queue for long operations
   - Adding progress streaming via Server-Sent Events

2. **Cold Starts:** Serverless functions have cold start latency (1-3 seconds). First request after idle period will be slower.

3. **Stateless Architecture:** Cannot use in-memory state (like memory session store). All state must be in database or external storage.

4. **WebSocket Limitations:** Current WebSocket setup in `server/index.ts` won't work on Vercel. WebSockets require persistent connections, incompatible with serverless. Consider:
   - Removing WebSocket routes if not critical
   - Using Vercel Edge Functions with WebSocket support (preview feature)
   - Migrating real-time features to Supabase Realtime

---

## Success Criteria

Deployment is successful when:

✅ All tests in "Testing Checklist" pass  
✅ No 404 errors on `/api/*` routes  
✅ No white screen on root URL  
✅ Client-side routing works without page refresh  
✅ Static assets load correctly  
✅ Sessions persist across requests  
✅ Local development remains fully functional  
✅ No console errors in browser or Vercel logs  

---

## Implementation Notes

**Order of Operations:**
1. Create `server/app.ts` first (foundation)
2. Update `server/index.ts` to use new app factory
3. Test local development: `npm run dev`
4. Create `api/[...path].ts` Vercel function
5. Update `vercel.json` routing
6. Update `vite.config.ts` plugin conditionals
7. Test local production build: `npm run build && npm start`
8. Commit changes
9. Deploy to Vercel
10. Configure environment variables in Vercel dashboard
11. Test deployed application
12. Monitor Vercel logs for errors

**Development vs Production:**
- Development: Full Express server with Vite dev middleware
- Production (Vercel): Serverless functions + static files
- Production (Local): Express server serving static files (for testing)

All three modes must work correctly.

---

## Architecture Changes

### Current Architecture
```mermaid
graph TB
    subgraph "Current (Broken on Vercel)"
        A[Vercel] --> B[dist/index.cjs]
        B --> C[Express Server with listen()]
        C --> D[API Routes]
        C --> E[Static Files]
    end
```

**Problem:** Vercel cannot execute `httpServer.listen()` in serverless functions.

### Target Architecture
```mermaid
graph TB
    subgraph "Target (Serverless)"
        V[Vercel Request] --> R{Route Type?}
        R -->|/api/**| F[api/[...path].ts]
        R -->|/assets/**| S1[Static: dist/public/assets]
        R -->|/*| S2[Static: dist/public/index.html]
        
        F --> APP[Express App (no listen)]
        APP --> M[Middleware Chain]
        M --> AR[API Routes]
    end
    
    subgraph "Local Development"
        L[npm run dev] --> SI[server/index.ts]
        SI --> APP2[createApp()]
        SI --> LS[app.listen()]
        APP2 --> V2[Vite Dev Server]
    end
```

---

## Implementation Plan

### A. Server Refactoring: Separate App from Lifecycle

**Objective:** Extract Express app configuration from server lifecycle management.

#### Create `server/app.ts`

This file exports a factory function that creates and configures the Express app without starting the server.

**Responsibilities:**
- Configure Express middleware (JSON parser, URL-encoded, request ID, logging)
- Set up authentication middleware (Supabase JWT validation)
- Register all API routes
- Set up error handling middleware
- Configure session management with proper trust proxy and cookie settings

**Key Requirements:**
- **No `listen()` call** - the app must be configurable but not started
- **Idempotent** - can be called multiple times (important for serverless cold starts)
- **Environment-aware** - handle both development and production configurations
- **Stateless** - no global state that persists between invocations

**Session Configuration for Vercel:**
```
Session Store: connect-pg-simple (PostgreSQL-backed)
Trust Proxy: app.set('trust proxy', 1)
Cookie Settings:
  - secure: process.env.NODE_ENV === 'production'
  - sameSite: 'lax'
  - maxAge: 30 days
  - httpOnly: true
```

**Error Handling:**
- If `DATABASE_URL` or `SESSION_SECRET` missing in production, log warnings but don't crash
- Return 500 with message "Server configuration incomplete" for requests requiring auth

**Health Check Endpoint:**
Add `/api/health` route that returns:
```
{
  "ok": true,
  "nodeEnv": process.env.NODE_ENV,
  "hasDatabase": Boolean(process.env.DATABASE_URL),
  "hasSessionSecret": Boolean(process.env.SESSION_SECRET),
  "timestamp": ISO8601 string
}
```

#### Update `server/index.ts`

Transform this file to be the local development entry point only.

**Changes:**
1. Import `createApp()` from `./app`
2. Call `createApp()` to get Express app
3. Keep all server lifecycle code (httpServer, graceful shutdown, signal handlers)
4. Keep Vite dev server integration for development mode
5. Keep static file serving for production mode (though not used on Vercel)
6. Keep `app.listen()` call with port/host configuration

**Conditional Logic:**
- Development mode: Set up Vite middleware after routes
- Production mode: Set up static file serving after routes

**No Breaking Changes:**
- `npm run dev` must continue to work identically
- `npm start` should still work for local production testing

---

### B. Vercel Serverless Function: API Handler

**Objective:** Create a Vercel serverless function that routes `/api/**` requests to Express.

#### Create `api/[...path].ts`

This is a catch-all route handler for Vercel that forwards all API requests to Express.

**Location:** `api/[...path].ts` (Vercel File System Routing convention)

**Implementation Strategy:**
```
1. Import createApp from server/app
2. Create Express app instance (singleton pattern at module scope)
3. Export default async handler function
4. Handler receives VercelRequest and VercelResponse
5. Forward req/res to Express app
6. Return response
```

**Type Safety:**
- Install `@vercel/node` as dev dependency
- Use `VercelRequest` and `VercelResponse` types
- Handle TypeScript compilation for Vercel's Node.js runtime

**Singleton Pattern:**
The Express app should be instantiated once per serverless function instance (not per request) to optimize cold start performance:
```
const app = createApp(); // Module-level singleton

export default async function handler(req, res) {
  return app(req, res);
}
```

**Error Handling:**
- Catch any errors from Express app
- Return 500 with generic error message
- Log errors to Vercel logs (console.error)

**Timeout Considerations:**
- Vercel default timeout is 10 seconds (can be increased to 60s for Pro)
- Long-running operations (course generation) may need optimization or streaming responses

---

### C. Vercel Configuration: SPA + Serverless Routing

**Objective:** Configure Vercel to serve static files and route API requests correctly.

#### Update `vercel.json`

Replace the current Vercel v2 builds configuration with a simpler routes-based approach.

**Key Principles:**
1. **Filesystem Routes First:** Let Vercel serve static assets directly
2. **API Routes:** Forward `/api/**` to serverless function
3. **SPA Fallback:** All other routes serve `index.html`

**Route Precedence (Order Matters):**
```
1. { "handle": "filesystem" }           // Serve existing files
2. { "src": "/(.*)", "dest": "/index.html" }  // SPA fallback for all other routes
```

**Build Configuration:**
```
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "framework": null
}
```

**Why Remove `builds` Array:**
- Vercel's File System Routing automatically detects `api/` directory
- No need to explicitly define `@vercel/node` and `@vercel/static` builds
- Simpler configuration, fewer opportunities for misconfiguration

**Environment Variables:**
Vercel will read environment variables from project settings (Vercel Dashboard), not from `.env-prod` file. The build process will have access to:
- `DATABASE_URL`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `YANDEX_*` variables
- Any other secrets configured in Vercel dashboard

---

### D. Build Process: Output Structure

**Objective:** Ensure build process creates correct directory structure for Vercel.

#### Verify `script/build.ts`

Current build script creates:
```
dist/
  index.cjs          # Express server bundle (not used on Vercel)
  public/            # Vite output
    index.html
    assets/
      *.js
      *.css
```

**Required Changes:**
None to `script/build.ts` itself, but ensure:
1. `vite build` creates `dist/public/index.html`
2. All static assets go to `dist/public/assets/`
3. The `dist/index.cjs` file is still generated (for local `npm start`)

**Vercel Build Command:**
- Command: `npm run build`
- Vercel executes this in CI environment
- Environment variables from Vercel dashboard are available during build

**Output Verification:**
After build completes, verify:
- `dist/public/index.html` exists
- `dist/public/assets/` contains JS/CSS bundles
- No absolute paths in HTML (all assets use relative paths)

---

### E. Vite Configuration: Remove Replit Plugins from Production

**Objective:** Clean up production builds by removing development-only plugins.

#### Update `vite.config.ts`

**Current Issue:**
`runtimeErrorOverlay()` is always active, even in production builds. This plugin is only useful in Replit development environment.

**Required Changes:**
1. Wrap `runtimeErrorOverlay()` in conditional logic
2. Only include when `process.env.REPL_ID` exists OR `NODE_ENV === 'development'`
3. Ensure `await import()` dynamic imports don't break on Vercel

**Conditional Plugin Loading:**
```
plugins: [
  react(),
  ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID 
    ? [runtimeErrorOverlay()] 
    : []),
  ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID
    ? [await import('@replit/vite-plugin-cartographer').then(m => m.cartographer())]
    : []),
  // ... other conditional Replit plugins
]
```

**Rationale:**
- Reduces bundle size in production
- Avoids potential conflicts with Vercel's serverless runtime
- Cleaner production builds

**Build Safety:**
- Verify that conditional imports don't cause build failures
- Test production build locally: `NODE_ENV=production npm run build`

---

### F. Session & Cookie Configuration for Serverless

**Objective:** Ensure Express sessions work correctly on Vercel's serverless infrastructure.

#### Session Store Configuration

**PostgreSQL-Backed Sessions:**
The project already uses `connect-pg-simple` which is ideal for serverless:
- Sessions persist in PostgreSQL database
- Multiple serverless instances share session state
- No memory store (which wouldn't work in serverless)

**Trust Proxy Setting:**
Vercel deploys behind a reverse proxy, so Express must trust the `X-Forwarded-*` headers:
```
app.set('trust proxy', 1)
```

**Cookie Configuration:**
```
{
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
  httpOnly: true,                                 // Prevent XSS
  sameSite: 'lax',                                // CSRF protection
  maxAge: 30 * 24 * 60 * 60 * 1000               // 30 days
}
```

**Environment Variable Validation:**
In `server/app.ts`, add checks:
```
if (process.env.NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL) {
    console.warn('[Session] Missing DATABASE_URL in production');
  }
  if (!process.env.SESSION_SECRET) {
    console.warn('[Session] Missing SESSION_SECRET in production');
  }
}
```

**Session Store Initialization:**
```
If DATABASE_URL exists:
  Use connect-pg-simple with PostgreSQL
Else:
  Use memory store (development only)
  Log warning if in production
```

---

### G. Environment Variables: Vercel Dashboard Configuration

**Objective:** Document which environment variables must be set in Vercel dashboard.

#### Required Environment Variables

These must be configured in Vercel Project Settings → Environment Variables:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `DATABASE_URL` | PostgreSQL connection for Drizzle ORM and sessions | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Express session encryption key | Random 64-char string |
| `SUPABASE_URL` | Supabase project URL for auth | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` |
| `YANDEX_PROMPT_ID` | Yandex AI prompt identifier | From Yandex Cloud console |
| `YANDEX_FOLDER_ID` | Yandex Cloud folder ID | From Yandex Cloud console |
| `YANDEX_API_KEY` | Yandex AI API authentication | From Yandex Cloud console |
| `NODE_ENV` | Runtime environment (auto-set by Vercel) | `production` |

**How to Set:**
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add each variable for "Production" environment
3. Source values from working local `.env` file or Supabase/Yandex dashboards
4. DO NOT commit secrets to Git
5. Re-deploy after adding/updating variables

**Validation:**
Test that variables are loaded correctly by checking `/api/health` response after deployment.

---

### H. Static Asset Serving: Fix "Download File" Issue

**Objective:** Ensure `index.html` is served as HTML, not downloaded as a file.

#### Root Cause Analysis

If `index.html` downloads instead of rendering, possible causes:
1. Incorrect `Content-Type` header (should be `text/html; charset=utf-8`)
2. Wrong `Content-Disposition` header (should be absent or `inline`)
3. Vercel output directory misconfiguration

#### Verification Steps

**Check Vercel Configuration:**
- Output Directory must be `dist/public`
- `index.html` must exist at `dist/public/index.html` (not nested deeper)

**Check HTML Meta Tags:**
Ensure `client/index.html` has:
```
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

**Check Vercel Routing:**
The SPA fallback route `{ "src": "/(.*)", "dest": "/index.html" }` should automatically serve HTML with correct content type.

**Test After Deploy:**
1. Open browser DevTools → Network tab
2. Navigate to deployed URL
3. Check response headers for root request:
   - `Content-Type: text/html; charset=utf-8`
   - No `Content-Disposition` header
   - Status: 200

---

## File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `server/app.ts` | **CREATE** | Express app factory without server lifecycle |
| `server/index.ts` | **MODIFY** | Use createApp(), keep listen() for local dev |
| `api/[...path].ts` | **CREATE** | Vercel serverless function for API routes |
| `vercel.json` | **REPLACE** | Simplified routing configuration |
| `vite.config.ts` | **MODIFY** | Conditional Replit plugins (dev only) |
| `package.json` | **MODIFY** | Add `@vercel/node` to devDependencies |

---

## Testing Checklist

### Local Development Testing
```
Test Case: Local dev server starts
Command: npm run dev
Expected: Server runs on port 5000, Vite HMR works
Verify: Open http://localhost:5000, check API routes

Test Case: Production build locally
Command: npm run build
Expected: dist/public/index.html created, no errors
Verify: Check dist/ directory structure

Test Case: Local production server
Command: npm start
Expected: Server serves from dist/public
Verify: Open http://localhost:5000, test API
```

### Vercel Deployment Testing
```
Test Case: Deploy to Vercel
Action: Push to main branch or run vercel deploy
Expected: Build succeeds, deployment URL provided
Verify: Check Vercel logs for build errors

Test Case: Root route serves SPA
Request: GET https://your-project.vercel.app/
Expected: HTML page loads, no white screen, no download
Verify: View source shows React app HTML

Test Case: Client-side routes work
Request: GET https://your-project.vercel.app/login
Expected: HTML page loads (same as root)
Verify: React Router handles client-side navigation

Test Case: Health check endpoint
Request: GET https://your-project.vercel.app/api/health
Expected: 200 status, JSON response { ok: true, nodeEnv: "production" }
Verify: Check hasDatabase and hasSessionSecret are true

Test Case: Authentication endpoints
Request: POST https://your-project.vercel.app/api/login
Expected: Not 404 (should return 400 or 401 without valid credentials)
Verify: Error response is structured JSON

Test Case: Static assets load
Request: GET https://your-project.vercel.app/assets/index-[hash].js
Expected: 200 status, JavaScript content
Verify: Network tab shows all assets loaded
```

---

## Rollback Plan

If deployment fails or causes issues:

1. **Immediate Rollback:** Use Vercel dashboard to revert to previous working deployment
2. **Local Testing:** Test changes locally before deploying: `npm run build && npm start`
3. **Staged Rollout:** Deploy to Vercel preview environment first (push to feature branch)
4. **Monitoring:** Check Vercel logs and `/api/health` endpoint after each change

**Critical Files Backup:**
Before starting, save copies of:
- `server/index.ts` (current version)
- `vercel.json` (current version)

---

## Vercel Dashboard Configuration

After code changes are deployed, configure these settings in Vercel dashboard:

### Build & Development Settings
```
Framework Preset: Other
Build Command: npm run build
Output Directory: dist/public
Install Command: npm install
Node.js Version: 18.x (or latest LTS)
```

### Root Directory
```
Root Directory: ./
```

### Environment Variables
Set all variables listed in section G (Environment Variables) above.

### Function Configuration
```
Max Duration: 60 seconds (for course generation endpoints)
Memory: 1024 MB (default)
```

---

## Known Limitations

1. **Long-Running Operations:** Course generation (AI-based) may take 60+ seconds, which exceeds Vercel's default function timeout. Consider:
   - Upgrading to Vercel Pro for longer timeouts
   - Implementing async job queue for long operations
   - Adding progress streaming via Server-Sent Events

2. **Cold Starts:** Serverless functions have cold start latency (1-3 seconds). First request after idle period will be slower.

3. **Stateless Architecture:** Cannot use in-memory state (like memory session store). All state must be in database or external storage.

4. **WebSocket Limitations:** Current WebSocket setup in `server/index.ts` won't work on Vercel. WebSockets require persistent connections, incompatible with serverless. Consider:
   - Removing WebSocket routes if not critical
   - Using Vercel Edge Functions with WebSocket support (preview feature)
   - Migrating real-time features to Supabase Realtime

---

## Success Criteria

Deployment is successful when:

✅ All tests in "Testing Checklist" pass  
✅ No 404 errors on `/api/*` routes  
✅ No white screen on root URL  
✅ Client-side routing works without page refresh  
✅ Static assets load correctly  
✅ Sessions persist across requests  
✅ Local development remains fully functional  
✅ No console errors in browser or Vercel logs  

---

## Implementation Notes

**Order of Operations:**
1. Create `server/app.ts` first (foundation)
2. Update `server/index.ts` to use new app factory
3. Test local development: `npm run dev`
4. Create `api/[...path].ts` Vercel function
5. Update `vercel.json` routing
6. Update `vite.config.ts` plugin conditionals
7. Test local production build: `npm run build && npm start`
8. Commit changes
9. Deploy to Vercel
10. Configure environment variables in Vercel dashboard
11. Test deployed application
12. Monitor Vercel logs for errors

**Development vs Production:**
- Development: Full Express server with Vite dev middleware
- Production (Vercel): Serverless functions + static files
- Production (Local): Express server serving static files (for testing)

All three modes must work correctly.

---

## Architecture Changes

### Current Architecture
```mermaid
graph TB
    subgraph "Current (Broken on Vercel)"
        A[Vercel] --> B[dist/index.cjs]
        B --> C[Express Server with listen()]
        C --> D[API Routes]
        C --> E[Static Files]
    end
```

**Problem:** Vercel cannot execute `httpServer.listen()` in serverless functions.

### Target Architecture
```mermaid
graph TB
    subgraph "Target (Serverless)"
        V[Vercel Request] --> R{Route Type?}
        R -->|/api/**| F[api/[...path].ts]
        R -->|/assets/**| S1[Static: dist/public/assets]
        R -->|/*| S2[Static: dist/public/index.html]
        
        F --> APP[Express App (no listen)]
        APP --> M[Middleware Chain]
        M --> AR[API Routes]
    end
    
    subgraph "Local Development"
        L[npm run dev] --> SI[server/index.ts]
        SI --> APP2[createApp()]
        SI --> LS[app.listen()]
        APP2 --> V2[Vite Dev Server]
    end
```

---

## Implementation Plan

### A. Server Refactoring: Separate App from Lifecycle

**Objective:** Extract Express app configuration from server lifecycle management.

#### Create `server/app.ts`

This file exports a factory function that creates and configures the Express app without starting the server.

**Responsibilities:**
- Configure Express middleware (JSON parser, URL-encoded, request ID, logging)
- Set up authentication middleware (Supabase JWT validation)
- Register all API routes
- Set up error handling middleware
- Configure session management with proper trust proxy and cookie settings

**Key Requirements:**
- **No `listen()` call** - the app must be configurable but not started
- **Idempotent** - can be called multiple times (important for serverless cold starts)
- **Environment-aware** - handle both development and production configurations
- **Stateless** - no global state that persists between invocations

**Session Configuration for Vercel:**
```
Session Store: connect-pg-simple (PostgreSQL-backed)
Trust Proxy: app.set('trust proxy', 1)
Cookie Settings:
  - secure: process.env.NODE_ENV === 'production'
  - sameSite: 'lax'
  - maxAge: 30 days
  - httpOnly: true
```

**Error Handling:**
- If `DATABASE_URL` or `SESSION_SECRET` missing in production, log warnings but don't crash
- Return 500 with message "Server configuration incomplete" for requests requiring auth

**Health Check Endpoint:**
Add `/api/health` route that returns:
```
{
  "ok": true,
  "nodeEnv": process.env.NODE_ENV,
  "hasDatabase": Boolean(process.env.DATABASE_URL),
  "hasSessionSecret": Boolean(process.env.SESSION_SECRET),
  "timestamp": ISO8601 string
}
```

#### Update `server/index.ts`

Transform this file to be the local development entry point only.

**Changes:**
1. Import `createApp()` from `./app`
2. Call `createApp()` to get Express app
3. Keep all server lifecycle code (httpServer, graceful shutdown, signal handlers)
4. Keep Vite dev server integration for development mode
5. Keep static file serving for production mode (though not used on Vercel)
6. Keep `app.listen()` call with port/host configuration

**Conditional Logic:**
- Development mode: Set up Vite middleware after routes
- Production mode: Set up static file serving after routes

**No Breaking Changes:**
- `npm run dev` must continue to work identically
- `npm start` should still work for local production testing

---

### B. Vercel Serverless Function: API Handler

**Objective:** Create a Vercel serverless function that routes `/api/**` requests to Express.

#### Create `api/[...path].ts`

This is a catch-all route handler for Vercel that forwards all API requests to Express.

**Location:** `api/[...path].ts` (Vercel File System Routing convention)

**Implementation Strategy:**
```
1. Import createApp from server/app
2. Create Express app instance (singleton pattern at module scope)
3. Export default async handler function
4. Handler receives VercelRequest and VercelResponse
5. Forward req/res to Express app
6. Return response
```

**Type Safety:**
- Install `@vercel/node` as dev dependency
- Use `VercelRequest` and `VercelResponse` types
- Handle TypeScript compilation for Vercel's Node.js runtime

**Singleton Pattern:**
The Express app should be instantiated once per serverless function instance (not per request) to optimize cold start performance:
```
const app = createApp(); // Module-level singleton

export default async function handler(req, res) {
  return app(req, res);
}
```

**Error Handling:**
- Catch any errors from Express app
- Return 500 with generic error message
- Log errors to Vercel logs (console.error)

**Timeout Considerations:**
- Vercel default timeout is 10 seconds (can be increased to 60s for Pro)
- Long-running operations (course generation) may need optimization or streaming responses

---

### C. Vercel Configuration: SPA + Serverless Routing

**Objective:** Configure Vercel to serve static files and route API requests correctly.

#### Update `vercel.json`

Replace the current Vercel v2 builds configuration with a simpler routes-based approach.

**Key Principles:**
1. **Filesystem Routes First:** Let Vercel serve static assets directly
2. **API Routes:** Forward `/api/**` to serverless function
3. **SPA Fallback:** All other routes serve `index.html`

**Route Precedence (Order Matters):**
```
1. { "handle": "filesystem" }           // Serve existing files
2. { "src": "/(.*)", "dest": "/index.html" }  // SPA fallback for all other routes
```

**Build Configuration:**
```
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "framework": null
}
```

**Why Remove `builds` Array:**
- Vercel's File System Routing automatically detects `api/` directory
- No need to explicitly define `@vercel/node` and `@vercel/static` builds
- Simpler configuration, fewer opportunities for misconfiguration

**Environment Variables:**
Vercel will read environment variables from project settings (Vercel Dashboard), not from `.env-prod` file. The build process will have access to:
- `DATABASE_URL`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `YANDEX_*` variables
- Any other secrets configured in Vercel dashboard

---

### D. Build Process: Output Structure

**Objective:** Ensure build process creates correct directory structure for Vercel.

#### Verify `script/build.ts`

Current build script creates:
```
dist/
  index.cjs          # Express server bundle (not used on Vercel)
  public/            # Vite output
    index.html
    assets/
      *.js
      *.css
```

**Required Changes:**
None to `script/build.ts` itself, but ensure:
1. `vite build` creates `dist/public/index.html`
2. All static assets go to `dist/public/assets/`
3. The `dist/index.cjs` file is still generated (for local `npm start`)

**Vercel Build Command:**
- Command: `npm run build`
- Vercel executes this in CI environment
- Environment variables from Vercel dashboard are available during build

**Output Verification:**
After build completes, verify:
- `dist/public/index.html` exists
- `dist/public/assets/` contains JS/CSS bundles
- No absolute paths in HTML (all assets use relative paths)

---

### E. Vite Configuration: Remove Replit Plugins from Production

**Objective:** Clean up production builds by removing development-only plugins.

#### Update `vite.config.ts`

**Current Issue:**
`runtimeErrorOverlay()` is always active, even in production builds. This plugin is only useful in Replit development environment.

**Required Changes:**
1. Wrap `runtimeErrorOverlay()` in conditional logic
2. Only include when `process.env.REPL_ID` exists OR `NODE_ENV === 'development'`
3. Ensure `await import()` dynamic imports don't break on Vercel

**Conditional Plugin Loading:**
```
plugins: [
  react(),
  ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID 
    ? [runtimeErrorOverlay()] 
    : []),
  ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID
    ? [await import('@replit/vite-plugin-cartographer').then(m => m.cartographer())]
    : []),
  // ... other conditional Replit plugins
]
```

**Rationale:**
- Reduces bundle size in production
- Avoids potential conflicts with Vercel's serverless runtime
- Cleaner production builds

**Build Safety:**
- Verify that conditional imports don't cause build failures
- Test production build locally: `NODE_ENV=production npm run build`

---

### F. Session & Cookie Configuration for Serverless

**Objective:** Ensure Express sessions work correctly on Vercel's serverless infrastructure.

#### Session Store Configuration

**PostgreSQL-Backed Sessions:**
The project already uses `connect-pg-simple` which is ideal for serverless:
- Sessions persist in PostgreSQL database
- Multiple serverless instances share session state
- No memory store (which wouldn't work in serverless)

**Trust Proxy Setting:**
Vercel deploys behind a reverse proxy, so Express must trust the `X-Forwarded-*` headers:
```
app.set('trust proxy', 1)
```

**Cookie Configuration:**
```
{
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
  httpOnly: true,                                 // Prevent XSS
  sameSite: 'lax',                                // CSRF protection
  maxAge: 30 * 24 * 60 * 60 * 1000               // 30 days
}
```

**Environment Variable Validation:**
In `server/app.ts`, add checks:
```
if (process.env.NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL) {
    console.warn('[Session] Missing DATABASE_URL in production');
  }
  if (!process.env.SESSION_SECRET) {
    console.warn('[Session] Missing SESSION_SECRET in production');
  }
}
```

**Session Store Initialization:**
```
If DATABASE_URL exists:
  Use connect-pg-simple with PostgreSQL
Else:
  Use memory store (development only)
  Log warning if in production
```

---

### G. Environment Variables: Vercel Dashboard Configuration

**Objective:** Document which environment variables must be set in Vercel dashboard.

#### Required Environment Variables

These must be configured in Vercel Project Settings → Environment Variables:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `DATABASE_URL` | PostgreSQL connection for Drizzle ORM and sessions | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Express session encryption key | Random 64-char string |
| `SUPABASE_URL` | Supabase project URL for auth | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` |
| `YANDEX_PROMPT_ID` | Yandex AI prompt identifier | From Yandex Cloud console |
| `YANDEX_FOLDER_ID` | Yandex Cloud folder ID | From Yandex Cloud console |
| `YANDEX_API_KEY` | Yandex AI API authentication | From Yandex Cloud console |
| `NODE_ENV` | Runtime environment (auto-set by Vercel) | `production` |

**How to Set:**
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add each variable for "Production" environment
3. Source values from working local `.env` file or Supabase/Yandex dashboards
4. DO NOT commit secrets to Git
5. Re-deploy after adding/updating variables

**Validation:**
Test that variables are loaded correctly by checking `/api/health` response after deployment.

---

### H. Static Asset Serving: Fix "Download File" Issue

**Objective:** Ensure `index.html` is served as HTML, not downloaded as a file.

#### Root Cause Analysis

If `index.html` downloads instead of rendering, possible causes:
1. Incorrect `Content-Type` header (should be `text/html; charset=utf-8`)
2. Wrong `Content-Disposition` header (should be absent or `inline`)
3. Vercel output directory misconfiguration

#### Verification Steps

**Check Vercel Configuration:**
- Output Directory must be `dist/public`
- `index.html` must exist at `dist/public/index.html` (not nested deeper)

**Check HTML Meta Tags:**
Ensure `client/index.html` has:
```
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

**Check Vercel Routing:**
The SPA fallback route `{ "src": "/(.*)", "dest": "/index.html" }` should automatically serve HTML with correct content type.

**Test After Deploy:**
1. Open browser DevTools → Network tab
2. Navigate to deployed URL
3. Check response headers for root request:
   - `Content-Type: text/html; charset=utf-8`
   - No `Content-Disposition` header
   - Status: 200

---

## File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `server/app.ts` | **CREATE** | Express app factory without server lifecycle |
| `server/index.ts` | **MODIFY** | Use createApp(), keep listen() for local dev |
| `api/[...path].ts` | **CREATE** | Vercel serverless function for API routes |
| `vercel.json` | **REPLACE** | Simplified routing configuration |
| `vite.config.ts` | **MODIFY** | Conditional Replit plugins (dev only) |
| `package.json` | **MODIFY** | Add `@vercel/node` to devDependencies |

---

## Testing Checklist

### Local Development Testing
```
Test Case: Local dev server starts
Command: npm run dev
Expected: Server runs on port 5000, Vite HMR works
Verify: Open http://localhost:5000, check API routes

Test Case: Production build locally
Command: npm run build
Expected: dist/public/index.html created, no errors
Verify: Check dist/ directory structure

Test Case: Local production server
Command: npm start
Expected: Server serves from dist/public
Verify: Open http://localhost:5000, test API
```

### Vercel Deployment Testing
```
Test Case: Deploy to Vercel
Action: Push to main branch or run vercel deploy
Expected: Build succeeds, deployment URL provided
Verify: Check Vercel logs for build errors

Test Case: Root route serves SPA
Request: GET https://your-project.vercel.app/
Expected: HTML page loads, no white screen, no download
Verify: View source shows React app HTML

Test Case: Client-side routes work
Request: GET https://your-project.vercel.app/login
Expected: HTML page loads (same as root)
Verify: React Router handles client-side navigation

Test Case: Health check endpoint
Request: GET https://your-project.vercel.app/api/health
Expected: 200 status, JSON response { ok: true, nodeEnv: "production" }
Verify: Check hasDatabase and hasSessionSecret are true

Test Case: Authentication endpoints
Request: POST https://your-project.vercel.app/api/login
Expected: Not 404 (should return 400 or 401 without valid credentials)
Verify: Error response is structured JSON

Test Case: Static assets load
Request: GET https://your-project.vercel.app/assets/index-[hash].js
Expected: 200 status, JavaScript content
Verify: Network tab shows all assets loaded
```

---

## Rollback Plan

If deployment fails or causes issues:

1. **Immediate Rollback:** Use Vercel dashboard to revert to previous working deployment
2. **Local Testing:** Test changes locally before deploying: `npm run build && npm start`
3. **Staged Rollout:** Deploy to Vercel preview environment first (push to feature branch)
4. **Monitoring:** Check Vercel logs and `/api/health` endpoint after each change

**Critical Files Backup:**
Before starting, save copies of:
- `server/index.ts` (current version)
- `vercel.json` (current version)

---

## Vercel Dashboard Configuration

After code changes are deployed, configure these settings in Vercel dashboard:

### Build & Development Settings
```
Framework Preset: Other
Build Command: npm run build
Output Directory: dist/public
Install Command: npm install
Node.js Version: 18.x (or latest LTS)
```

### Root Directory
```
Root Directory: ./
```

### Environment Variables
Set all variables listed in section G (Environment Variables) above.

### Function Configuration
```
Max Duration: 60 seconds (for course generation endpoints)
Memory: 1024 MB (default)
```

---

## Known Limitations

1. **Long-Running Operations:** Course generation (AI-based) may take 60+ seconds, which exceeds Vercel's default function timeout. Consider:
   - Upgrading to Vercel Pro for longer timeouts
   - Implementing async job queue for long operations
   - Adding progress streaming via Server-Sent Events

2. **Cold Starts:** Serverless functions have cold start latency (1-3 seconds). First request after idle period will be slower.

3. **Stateless Architecture:** Cannot use in-memory state (like memory session store). All state must be in database or external storage.

4. **WebSocket Limitations:** Current WebSocket setup in `server/index.ts` won't work on Vercel. WebSockets require persistent connections, incompatible with serverless. Consider:
   - Removing WebSocket routes if not critical
   - Using Vercel Edge Functions with WebSocket support (preview feature)
   - Migrating real-time features to Supabase Realtime

---

## Success Criteria

Deployment is successful when:

✅ All tests in "Testing Checklist" pass  
✅ No 404 errors on `/api/*` routes  
✅ No white screen on root URL  
✅ Client-side routing works without page refresh  
✅ Static assets load correctly  
✅ Sessions persist across requests  
✅ Local development remains fully functional  
✅ No console errors in browser or Vercel logs  

---

## Implementation Notes

**Order of Operations:**
1. Create `server/app.ts` first (foundation)
2. Update `server/index.ts` to use new app factory
3. Test local development: `npm run dev`
4. Create `api/[...path].ts` Vercel function
5. Update `vercel.json` routing
6. Update `vite.config.ts` plugin conditionals
7. Test local production build: `npm run build && npm start`
8. Commit changes
9. Deploy to Vercel
10. Configure environment variables in Vercel dashboard
11. Test deployed application
12. Monitor Vercel logs for errors

**Development vs Production:**
- Development: Full Express server with Vite dev middleware
- Production (Vercel): Serverless functions + static files
- Production (Local): Express server serving static files (for testing)

All three modes must work correctly.
