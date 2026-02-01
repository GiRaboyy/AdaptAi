# Vercel Dashboard Configuration - Quick Reference

## 🚀 Build Settings

Navigate to: **Vercel Dashboard → Project → Settings → General**

```
Framework Preset:      Other
Build Command:         npm run build
Output Directory:      dist/public
Install Command:       npm install
Node.js Version:       18.x
Root Directory:        ./
```

---

## 🔐 Environment Variables

Navigate to: **Vercel Dashboard → Project → Settings → Environment Variables**

### Production Environment

Add these variables for **Production** environment:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_SECRET=<64-character-random-string>
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
YANDEX_PROMPT_ID=<from-yandex-cloud>
YANDEX_FOLDER_ID=<from-yandex-cloud>
YANDEX_API_KEY=<from-yandex-cloud>
APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

### Generate SESSION_SECRET
```bash
openssl rand -base64 64
```

### Getting Supabase Values
1. Go to Supabase Dashboard
2. Select your project
3. Settings → API
4. Copy `URL` and `service_role` key

---

## ⚙️ Function Configuration

Navigate to: **Vercel Dashboard → Project → Settings → Functions**

```
Max Duration:    60 seconds
Memory:          1024 MB
```

---

## 📊 Deployment Verification

### After Deployment, Test These URLs:

1. **Root (SPA)**
   ```
   https://your-app.vercel.app/
   ```
   ✅ Should load React app, not white screen

2. **Health Check**
   ```
   https://your-app.vercel.app/api/health
   ```
   ✅ Should return JSON with `ok: true`

3. **Client Route**
   ```
   https://your-app.vercel.app/login
   ```
   ✅ Should load React app, not 404

4. **Login Endpoint**
   ```bash
   curl -X POST https://your-app.vercel.app/api/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   ```
   ✅ Should return 401, not 404

---

## 🔍 Monitoring

### View Logs
Navigate to: **Vercel Dashboard → Project → Logs**

Look for:
- ✅ No 404 errors on `/api/*` routes
- ✅ Health check returns `hasDatabase: true`, `hasSessionSecret: true`
- ⚠️ Any timeout errors (course generation)
- ⚠️ Missing environment variable warnings

### Common Issues

**Issue: 404 on API routes**
- Check: Environment variables configured?
- Check: Vercel function deployed? (should see `api/` in Functions tab)

**Issue: White screen**
- Check: `dist/public/index.html` exists after build
- Check: Output Directory is `dist/public`
- Check: No errors in browser console

**Issue: Database errors**
- Check: `DATABASE_URL` environment variable set correctly
- Check: Database accessible from Vercel (firewall rules)

---

## 📝 Deployment Checklist

- [ ] Environment variables configured in Vercel Dashboard
- [ ] Build settings updated (Output Directory: `dist/public`)
- [ ] Code pushed to main branch or `vercel --prod` run
- [ ] Deployment succeeded (no build errors)
- [ ] `/` returns HTML (not white screen)
- [ ] `/api/health` returns 200 with `ok: true`
- [ ] `/login` returns HTML (not 404)
- [ ] Browser console shows no errors
- [ ] All static assets load (check Network tab)

---

## 🆘 Quick Troubleshooting

### Deployment Failed
```bash
# Check build locally first
npm run build

# Check for TypeScript errors
npm run check
```

### API 404 Errors
1. Check Vercel Dashboard → Functions tab
2. Should see `api/[...path]` function listed
3. If not, check `api/[...path].ts` file exists
4. Re-deploy

### Missing Environment Variables
1. Vercel Dashboard → Settings → Environment Variables
2. Add missing variables
3. Deployments → Click latest → Redeploy

### Rollback Deployment
1. Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "⋮" menu → Promote to Production

---

## 📞 Support Resources

- **Vercel Status:** https://www.vercel-status.com/
- **Vercel Docs:** https://vercel.com/docs
- **Project Logs:** Vercel Dashboard → Project → Logs
- **Build Logs:** Vercel Dashboard → Project → Deployments → [deployment] → Building

---

**Last Updated:** February 1, 2026  
**Configuration Version:** Serverless v1.0
