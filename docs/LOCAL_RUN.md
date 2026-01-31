# Local development and Docker usage

## Prerequisites
- Node.js 20+
- npm 10+
- Docker and Docker Compose

## Run locally without Docker
1. Install dependencies:
   - `npm install`
2. Create env file:
   - `cp .env.example .env`
3. Edit `.env` with your configuration:
   - Database: `DATABASE_URL` (Supabase or local PostgreSQL)
   - Session: `SESSION_SECRET`
   - Yandex AI: `YANDEX_CLOUD_API_KEY`, `YANDEX_CLOUD_PROJECT_FOLDER_ID`
   - **Email (Required)**: See [Email Configuration](#email-configuration) below
4. Start dev server:
   - `npm run dev`
5. Check health endpoints:
   - `curl http://localhost:5000/healthz`
   - `curl http://localhost:5000/readyz`

## Email Configuration

ADAPT requires email verification for user registration. Choose one option:

### Option A: Supabase Auth (Recommended)
1. Set in `.env`:
   ```bash
   DATABASE_FILE_STORAGE_URL=https://your-project.supabase.co
   DATABASE_FILE_STORAGE_KEY=your_service_role_key
   SUPABASE_ANON_KEY=your_anon_key
   
   # Frontend (VITE_ prefix required)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   
   APP_URL=http://localhost:5000  # Or your tunnel URL for testing
   ```
2. In Supabase Dashboard → Auth → URL Configuration:
   - Add `http://localhost:5000/auth/callback` to Redirect URLs
   - If using tunnel: Also add `https://your-tunnel.ngrok.io/auth/callback`

### Option B: Direct SMTP (Yandex)
1. Generate APP PASSWORD at https://id.yandex.ru/security
2. Set in `.env`:
   ```bash
   SMTP_HOST=smtp.yandex.ru
   SMTP_PORT=465
   SMTP_USER=your-email@yandex.com
   SMTP_PASSWORD=your_app_password
   SMTP_FROM=ADAPT <your-email@yandex.com>
   APP_URL=http://localhost:5000
   ```
3. Test: `npx tsx test-email-config.ts`

## Testing Email Verification with Tunnel (ngrok/localtunnel)

Email verification links won't work with `localhost` on external devices. Use a tunnel:

### Setup with ngrok:

1. **Install ngrok**: https://ngrok.com/download

2. **Start your dev server**:
   ```bash
   npm run dev
   ```

3. **Start ngrok tunnel**:
   ```bash
   ngrok http 5000
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Update `.env`**:
   ```bash
   APP_URL=https://abc123.ngrok.io
   ```

6. **Add to Supabase Redirect URLs**:
   - Go to Supabase Dashboard → Auth → URL Configuration
   - Add: `https://abc123.ngrok.io/auth/callback`

7. **Restart your dev server** to pick up the new APP_URL

8. **Test the flow**:
   - Register at `https://abc123.ngrok.io/auth`
   - Check email and click verification link
   - You should land on `/auth/callback` and be verified

### Alternative: localtunnel

```bash
npx localtunnel --port 5000
```

**Important**: Tunnel URLs change on restart. Update both `.env` and Supabase Redirect URLs.

## Build and run with Docker
1. Ensure `.env` exists (copied from `.env.example`).
2. Build and start containers:
   - `npm run docker:up`
3. Check health endpoints from host:
   - `curl http://localhost:5000/healthz`
   - `curl http://localhost:5000/readyz`
4. View logs:
   - `docker compose logs -f adapt-app`
5. Stop containers:
   - `npm run docker:down`

## Logs and observability
- Structured JSON logs are emitted via Pino.
- Each request has an `x-request-id` header used for correlation.
- Error responses include `{ "error": { "code", "message", "request_id" } }`.
- **Tokens are masked** in logs for security.

## Graceful shutdown
- On `SIGTERM`/`SIGINT` or fatal errors, the server:
  - Stops accepting new connections.
  - Waits for in-flight requests (up to `SHUTDOWN_TIMEOUT_MS`).
  - Exits with `0` on success, `1` on timeout.
