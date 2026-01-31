# Email Configuration Guide

## Overview

ADAPT uses a dual-path email delivery system for email verification:

1. **Supabase Auth (Primary)**: When configured, Supabase handles email delivery through its managed service
2. **Direct SMTP (Fallback)**: When Supabase is unavailable or fails, the system uses nodemailer with custom SMTP settings

This redundancy ensures reliable email delivery even if one service experiences issues.

## Yandex SMTP Setup

### Step 1: Generate APP PASSWORD

Yandex requires an APP PASSWORD (not your regular password) for SMTP authentication.

1. Navigate to [Yandex ID Security Settings](https://id.yandex.ru/security)
2. Scroll to the "App passwords" section
3. Click "Create app password"
4. Select "Mail" as the application type
5. Enter a descriptive name (e.g., "ADAPT SMTP")
6. Copy the generated 16-character password
7. **Important**: Save this password securely - you won't be able to see it again

### Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Yandex SMTP Configuration
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=adapt-ai@yandex.com
SMTP_PASSWORD=your_app_password_here
SMTP_FROM=ADAPT <adapt-ai@yandex.com>

# Application Base URL (critical for email links)
APP_URL=http://localhost:5000
```

**Port Options:**
- **465**: Direct SSL connection (recommended for production)
- **587**: STARTTLS upgrade (alternative if 465 is blocked)

### Step 3: Test SMTP Connection

Start your server and check the logs:

```bash
npm run dev
```

Look for:
```
[Email] Transporter initialized: smtp.yandex.ru:465 (SSL)
```

If you see `[Email] SMTP not configured`, check that all environment variables are set correctly.

## Supabase Configuration (Optional)

### Enable Custom SMTP in Supabase Dashboard

1. Log in to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings → Auth → Email**
4. Scroll to "SMTP Settings"
5. Enable "Enable Custom SMTP"
6. Configure:
   - **SMTP Host**: `smtp.yandex.ru`
   - **SMTP Port**: `465`
   - **SMTP Username**: `adapt-ai@yandex.com`
   - **SMTP Password**: Your Yandex APP PASSWORD
   - **Sender Email**: `adapt-ai@yandex.com`
   - **Sender Name**: `ADAPT`
7. Click "Save"

### Configure Redirect URLs

**Critical for preventing `otp_expired` errors!**

1. Navigate to **Settings → Auth → URL Configuration**
2. Set **Site URL**:
   - Development: `http://localhost:5000`
   - Production: Your production domain (e.g., `https://adapt.example.com`)
3. Add **Redirect URLs**:
   - Development: `http://localhost:5000/auth/callback`
   - Production: `https://adapt.example.com/auth/callback`
4. Click "Save"

**Important**: The redirect URL in email links MUST match one of these configured URLs, or users will get `otp_expired` errors.

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | Optional | - | SMTP server hostname (e.g., smtp.yandex.ru) |
| `SMTP_PORT` | Optional | - | SMTP port (465 for SSL, 587 for STARTTLS) |
| `SMTP_USER` | Optional | - | SMTP username (your Yandex email) |
| `SMTP_PASSWORD` | Optional | - | Yandex APP PASSWORD (not regular password) |
| `SMTP_FROM` | Optional | `ADAPT <${SMTP_USER}>` | Display name and email for sent messages |
| `APP_URL` | Required | `http://localhost:5000` | Base URL for email verification links |
| `SUPABASE_ANON_KEY` | Optional | - | Enables Supabase Auth integration |
| `DATABASE_FILE_STORAGE_URL` | Optional | - | Supabase project URL |

## Troubleshooting

### Email Not Received

**Check 1: Verify SMTP Configuration**
```bash
# Look for this in server logs
[Email] Transporter initialized: smtp.yandex.ru:465 (SSL)
```

**Check 2: Check Spam Folder**
Email providers may initially mark emails as spam. Check the spam/junk folder.

**Check 3: Verify Yandex APP PASSWORD**
- Ensure you're using the APP PASSWORD, not your regular Yandex password
- Try regenerating the APP PASSWORD if authentication fails

**Check 4: Check Server Logs**
```bash
# Successful send
[Email] Verification email sent to user@example.com: <message-id>

# Failed send
[Email] Failed to send verification email to user@example.com: Error message
```

### "otp_expired" Error

This error occurs when clicking email verification links. Three main causes:

#### 1. Redirect URL Mismatch

**Symptom**: Error appears immediately when clicking the link

**Cause**: The callback URL in the email doesn't match Supabase's allowed redirect URLs

**Solution**:
1. Check Supabase Dashboard → Auth → URL Configuration
2. Ensure `http://localhost:5000/auth/callback` (or your production URL) is in the "Redirect URLs" list
3. Check server logs for: `[Auth] Supabase redirect URL: ...`
4. Make sure `APP_URL` environment variable matches the Site URL

#### 2. Token Already Used

**Symptom**: First click works, subsequent clicks fail

**Cause**: Email verification tokens are single-use. Once verified, the token becomes invalid.

**Common Trigger**: Email security scanners may pre-click links before you see the email.

**Solution**: This is expected behavior. If you've already verified your email, you can log in. If not, use the "Resend email" button.

#### 3. Token Expired

**Symptom**: Error after waiting several hours

**Cause**: Tokens expire after a set time (typically 1 hour for Supabase, 24 hours for custom tokens)

**Solution**: Click "Resend email" to generate a new verification link.

### SMTP Authentication Failed

**Error**: `[Email] SMTP connection failed: Invalid credentials`

**Solutions**:
1. Verify you're using the APP PASSWORD from Yandex, not your account password
2. Regenerate the APP PASSWORD in [Yandex ID Security](https://id.yandex.ru/security)
3. Check for typos in the `SMTP_PASSWORD` environment variable
4. Ensure no quotes around the password in `.env` file

### Port 465 Blocked by Firewall

**Error**: Connection timeout when connecting to SMTP server

**Solution**: Use port 587 instead:
```bash
SMTP_PORT=587
```

Port 587 uses STARTTLS, which is more likely to work through firewalls.

### Email Sending Works but Links Don't Work

**Check APP_URL Configuration**:
```bash
# Wrong - uses localhost when deployed to production
APP_URL=http://localhost:5000

# Correct for production
APP_URL=https://adapt.example.com
```

## Testing Email Delivery

### 1. Test Registration Flow

1. Register a new account with a real email address
2. Check server logs for:
   ```
   [Auth] Signup initiated: email=test@example.com
   [Auth] Current APP_URL env: http://localhost:5000
   [Auth] Supabase redirect URL: http://localhost:5000/auth/callback
   ```
3. Check your email inbox (and spam folder)
4. Click the verification link
5. Verify you're redirected to `/auth?verified=true`
6. See success toast: "Email confirmed! You can now login"

### 2. Test Resend Functionality

1. Try to login with unverified email
2. See error: "Email not verified. Check your inbox."
3. Click "Resend email" button
4. Check logs for:
   ```
   [Auth] Resending verification via Supabase: test@example.com
   ```
5. Receive new email with fresh verification link

### 3. Test SMTP Fallback

1. Temporarily unset Supabase environment variables:
   ```bash
   unset SUPABASE_ANON_KEY
   ```
2. Restart server
3. Register new account
4. Check logs for:
   ```
   [Auth] Supabase signup failed, falling back to custom email
   [Email] Verification email sent to user@example.com
   ```
5. Verify email arrives from your SMTP server

## Production Deployment Checklist

- [ ] Generate Yandex APP PASSWORD for production
- [ ] Set production `APP_URL` (e.g., `https://adapt.example.com`)
- [ ] Configure SMTP environment variables in production
- [ ] Update Supabase Dashboard redirect URLs with production domain
- [ ] Test registration flow in production environment
- [ ] Verify email links redirect correctly
- [ ] Monitor logs for `otp_expired` errors
- [ ] Set up email monitoring (track bounce rate, delivery rate)

## Rate Limits

### Yandex SMTP Limits

| Account Type | Daily Limit | Notes |
|--------------|-------------|-------|
| Free | 500 emails/day | Sufficient for small deployments |
| Business | 10,000 emails/day | Recommended for production |

**Recommendation**: Monitor your daily email volume. If approaching limits, consider:
1. Upgrading to Yandex Business
2. Using Supabase's managed email service
3. Implementing rate limiting on registration/resend endpoints

## Security Best Practices

1. **Never commit APP PASSWORDs to version control**
   - Use `.env` files (already in `.gitignore`)
   - Use environment variable management in production (e.g., Vercel, Railway)

2. **Use HTTPS in production**
   - Email verification links should always use `https://`
   - Set `APP_URL=https://your-domain.com` in production

3. **Rotate APP PASSWORDs periodically**
   - Regenerate APP PASSWORD every 6-12 months
   - Immediately rotate if compromised

4. **Monitor email delivery**
   - Track bounce rates and delivery failures
   - Alert on sudden increase in failed sends

## Support

If you encounter issues not covered in this guide:

1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a different email address
4. Contact the development team with logs and error details

## Additional Resources

- [Nodemailer Documentation](https://nodemailer.com)
- [Yandex SMTP Settings](https://yandex.com/support/mail/mail-clients.html)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
