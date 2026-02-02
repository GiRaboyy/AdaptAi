import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import { sendVerificationEmail } from "./email";
import { 
  isSupabaseAuthAvailable, 
  signUpWithSupabase, 
  resendVerificationEmail as resendSupabaseEmail,
  getSupabaseAuthClient 
} from "./supabase-auth";
import { getEnv, getSessionSecret, useSecureCookies, getAppUrl, isProduction } from "./env";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Use centralized environment configuration
  const sessionSecret = getSessionSecret();
  const isSecureCookie = useSecureCookies();
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: isSecureCookie,
      sameSite: "lax",
    },
  };

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      // "username" field is actually used for "email" in our schema, 
      // but passport-local defaults to "username" parameter.
      // We'll treat the input "username" as "email".
      try {
        const user = await storage.getUserByEmail(username);
        // Password is now nullable (managed by Supabase Auth)
        // Legacy login only works if password exists
        if (!user || !user.password) {
          return done(null, false);
        }
        
        if (!(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        
        // Check email verification
        if (!user.emailVerified) {
          return done(null, false, { message: "EMAIL_NOT_VERIFIED" });
        }
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      
      if (existingUser) {
        // User exists - check if they already verified email but trying to register again
        if (existingUser.emailVerified) {
          return res.status(400).json({ 
            message: "Пользователь уже зарегистрирован. Войдите.",
            errorCode: "USER_EXISTS",
          });
        }
        
        // User exists but email not verified locally - check Supabase status
        if (isSupabaseAuthAvailable()) {
          const { getSupabaseUserByEmail } = await import('./supabase-auth');
          const supabaseUser = await getSupabaseUserByEmail(req.body.email);
          
          if (supabaseUser?.emailConfirmed) {
            // Email is verified in Supabase but not in our DB - sync and update user
            const hashedPassword = await hashPassword(req.body.password);
            
            await storage.updateUser(existingUser.id, {
              name: req.body.name || existingUser.name,
              role: req.body.role || existingUser.role,
              password: hashedPassword,
              emailVerified: true,
              emailVerificationToken: null,
              emailVerificationExpires: null,
            });
            
            console.log(`[Auth] Updated pre-verified user: ${req.body.email}`);
            
            // Log them in
            const updatedUser = await storage.getUser(existingUser.id);
            req.login(updatedUser!, (err) => {
              if (err) return next(err);
              res.status(200).json({ 
                user: updatedUser, 
                message: "Email уже подтверждён. Добро пожаловать!" 
              });
            });
            return;
          }
        }
        
        // User exists but still not verified - resend verification
        return res.status(400).json({ 
          message: "Пользователь уже зарегистрирован. Подтвердите email или войдите.",
          errorCode: "USER_EXISTS_NOT_VERIFIED",
          canResend: true,
          email: req.body.email,
        });
      }

      const hashedPassword = await hashPassword(req.body.password);
      
      // Check if Supabase Auth is available for email verification
      const useSupabaseAuth = isSupabaseAuthAvailable();
      let supabaseUserId: string | undefined;
      let emailSentViaSupabase = false;
      
      // Diagnostic logging for redirect URL configuration
      const appUrl = getAppUrl();
      console.log(`[Auth] Signup initiated: email=${req.body.email}`);
      console.log(`[Auth] Supabase redirect URL: ${appUrl}/auth/callback`);
      
      if (useSupabaseAuth) {
        console.log(`[Auth] Using Supabase Auth for email verification: ${req.body.email}`);
        
        // Sign up with Supabase Auth - this sends the verification email automatically
        // Note: emailRedirectTo MUST match Supabase Dashboard → Auth → URL Configuration
        const supabaseResult = await signUpWithSupabase(
          req.body.email,
          req.body.password,
          { name: req.body.name, role: req.body.role }
        );
        
        if (supabaseResult.success) {
          supabaseUserId = supabaseResult.userId;
          emailSentViaSupabase = supabaseResult.needsEmailVerification || false;
          console.log(`[Auth] Supabase user created: ${supabaseUserId}, needs verification: ${emailSentViaSupabase}`);
        } else {
          // If Supabase signup fails, fall back to custom email
          console.warn(`[Auth] Supabase signup failed, falling back to custom email: ${supabaseResult.error}`);
        }
      }
      
      // Generate fallback email verification token (used if Supabase is not available)
      // Both Supabase and custom tokens are generated to support dual-path email delivery
      const verificationToken = randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        plan: "trial",
        createdCoursesCount: 0,
      });

      // If Supabase didn't send email, use nodemailer as fallback
      if (!emailSentViaSupabase) {
        console.log(`[Auth] Sending verification email via nodemailer: ${user.email}`);
        sendVerificationEmail({
          to: user.email,
          name: user.name,
          token: verificationToken,
        }).catch(err => {
          console.error(`[Auth] Failed to send verification email to ${user.email}:`, err);
        });
      }

      // Return user without logging in (must verify email first)
      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      };
      
      res.status(201).json({ 
        user: userResponse, 
        message: "Проверьте почту для подтверждения email",
        needsVerification: true,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      const { username, password } = req.body;
      
      // First check if user exists and get their email verification status
      const existingUser = await storage.getUserByEmail(username);
      
      if (existingUser && !existingUser.emailVerified) {
        // User exists but email not verified locally - check Supabase
        if (isSupabaseAuthAvailable()) {
          const { getSupabaseUserByEmail } = await import('./supabase-auth');
          const supabaseUser = await getSupabaseUserByEmail(username);
          
          if (supabaseUser?.emailConfirmed) {
            // Supabase says email is confirmed - sync to our DB
            await storage.updateUser(existingUser.id, {
              emailVerified: true,
              emailVerificationToken: null,
              emailVerificationExpires: null,
            });
            console.log(`[Auth Login] Synced email verification from Supabase for: ${username}`);
          }
        }
      }
      
      // Now proceed with passport authentication
      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) return next(err);
        
        if (!user) {
          // Check if it's an email verification issue
          if (info && info.message === "EMAIL_NOT_VERIFIED") {
            return res.status(403).json({ 
              message: "Email не подтверждён. Проверьте почту.",
              errorCode: "EMAIL_NOT_VERIFIED",
              canResend: true,
            });
          }
          return res.status(401).json({ message: "Неверный email или пароль" });
        }
        
        req.login(user, (err) => {
          if (err) return next(err);
          res.status(200).json(user);
        });
      })(req, res, next);
    } catch (err) {
      console.error('[Auth Login] Error:', err);
      next(err);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out" });
    });
  });

  // New JWT-compatible endpoint
  app.get("/api/me", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized" });
    }
    res.json(req.user);
  });

  // Legacy endpoint - kept for backward compatibility
  app.get("/api/user", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized" });
    }
    res.json(req.user);
  });

  // Email verification endpoint (legacy - for custom tokens)
  app.get("/auth/verify-email", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.redirect("/auth?error=invalid_token");
      }

      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.redirect("/auth?error=invalid_token");
      }

      // Check if token expired
      if (user.emailVerificationExpires && new Date() > new Date(user.emailVerificationExpires)) {
        return res.redirect("/auth?error=token_expired");
      }

      // Mark email as verified
      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });

      console.log(`[Auth] Email verified for user: ${user.email}`);
      res.redirect("/auth?verified=true");
    } catch (err) {
      console.error("[Auth] Email verification error:", err);
      res.redirect("/auth?error=server_error");
    }
  });

  // Supabase Auth callback - handles email verification from Supabase
  // NOTE: Supabase sends tokens in URL hash fragment (#access_token=...) which is NOT sent to server.
  // This route only handles server-side flows (token_hash in query params, errors).
  // For hash fragment flow, we pass through to let the frontend SPA handle it.
  app.get("/auth/callback", async (req, res, next) => {
    try {
      const { token_hash, type, error, error_description, code } = req.query;
      
      // Diagnostic logging
      console.log(`[Auth Callback] Received params:`, { 
        token_hash: token_hash ? '***' : undefined, 
        type, 
        error,
        code: code ? '***' : undefined 
      });
      
      // CRITICAL FIX: If no server-side params, let frontend SPA handle hash fragment!
      // Supabase sends tokens in hash (#access_token=...), not query params.
      // Without this check, we redirect to /auth?verified=true without actually verifying!
      if (!token_hash && !error && !code) {
        console.log(`[Auth Callback] No server params - letting SPA handle hash fragment`);
        return next(); // Let static handler serve the SPA
      }
      
      if (error) {
        console.error(`[Auth Callback] Supabase error: ${error} - ${error_description}`);
        return res.redirect(`/auth?error=${encodeURIComponent(String(error))}`);
      }

      // Handle PKCE code flow - let frontend handle code exchange
      if (code) {
        console.log(`[Auth Callback] PKCE code flow - letting SPA handle`);
        return next();
      }

      // If we have a token_hash, verify it with Supabase
      // CRITICAL: OTP tokens are single-use. Do NOT call verifyOtp twice!
      if (token_hash && type === 'signup') {
        const client = getSupabaseAuthClient();
        if (client) {
          const { data, error: verifyError } = await client.auth.verifyOtp({
            token_hash: String(token_hash),
            type: 'signup',
          });

          if (verifyError) {
            console.error(`[Auth Callback] Verify error: ${verifyError.message}`);
            return res.redirect(`/auth?error=verification_failed`);
          }

          if (data.user?.email) {
            // Update our database to mark user as verified
            const user = await storage.getUserByEmail(data.user.email);
            if (user) {
              await storage.updateUser(user.id, {
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null,
              });
              console.log(`[Auth Callback] Email verified successfully: ${user.email}`);
            } else {
              console.warn(`[Auth Callback] User not found in DB for email: ${data.user.email}`);
            }
          }
          
          return res.redirect('/auth?verified=true');
        } else {
          console.warn(`[Auth Callback] Supabase client not available`);
          return next(); // Let frontend handle
        }
      }

      // Fallback: let frontend SPA handle any unmatched cases
      console.log(`[Auth Callback] Unhandled params, letting SPA handle`);
      return next();
    } catch (err) {
      console.error("[Auth Callback] Error:", err);
      res.redirect("/auth?error=server_error");
    }
  });

  // Resend verification email
  app.post("/api/resend-verification", async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email обязателен" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      if (user.emailVerified) {
        return res.status(200).json({ message: "Email уже подтверждён" });
      }

      // Try Supabase first
      if (isSupabaseAuthAvailable()) {
        console.log(`[Auth] Resending verification via Supabase: ${email}`);
        const result = await resendSupabaseEmail(email);
        
        if (result.success) {
          return res.status(200).json({ message: "Письмо отправлено" });
        }
        // If Supabase fails, fall back to custom email
        console.warn(`[Auth] Supabase resend failed, using fallback: ${result.error}`);
      }

      // Fallback: Generate new token and send via nodemailer
      const verificationToken = randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await storage.updateUser(user.id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      });

      // Send verification email
      const emailSent = await sendVerificationEmail({
        to: user.email,
        name: user.name,
        token: verificationToken,
      });

      if (!emailSent) {
        console.error(`[Auth] Failed to send verification email to ${user.email}`);
      }

      res.status(200).json({ message: "Письмо отправлено" });
    } catch (err) {
      next(err);
    }
  });

  // Notify backend that email was verified via Supabase (called from frontend callback)
  // This endpoint accepts email in body but for security, we prefer the session-based confirm-sync
  app.post("/api/auth/email-verified", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email required" });
      }

      console.log(`[Auth] Email verification notification received for: ${email}`);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // User might not exist in our DB yet - that's ok
        console.log(`[Auth] Email verified notification for unknown user: ${email}`);
        return res.status(200).json({ message: "ok" });
      }

      if (!user.emailVerified) {
        await storage.updateUser(user.id, {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        });
        console.log(`[Auth] Email verified via frontend callback: ${email} (userId: ${user.id})`);
      } else {
        console.log(`[Auth] Email already verified for: ${email}`);
      }

      res.status(200).json({ message: "ok", verified: true });
    } catch (err) {
      console.error("[Auth] Email verified notification error:", err);
      res.status(500).json({ message: "Error" });
    }
  });

  // Secure endpoint to sync Supabase email verification status
  // This uses the Supabase JWT token to get the verified email
  app.post("/api/auth/confirm-sync", async (req, res) => {
    try {
      // Get the Authorization header
      const authHeader = req.headers.authorization;
      let email: string | undefined;
      let emailConfirmed = false;
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Decode the JWT to get the email (it's safe to decode without verification for getting claims)
        // The JWT is already verified by Supabase when issued
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          email = payload.email;
          // Check if email_confirmed is in the JWT or if confirmed_at exists
          emailConfirmed = !!payload.email_confirmed_at || payload.email_confirmed === true;
          console.log(`[Auth Confirm-Sync] JWT email: ${email}, confirmed: ${emailConfirmed}`);
        } catch (e) {
          console.warn('[Auth Confirm-Sync] Failed to decode JWT:', e);
        }
      }
      
      // Fallback to body email if no JWT
      if (!email) {
        email = req.body.email;
      }
      
      if (!email) {
        return res.status(400).json({ message: "Email required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // User doesn't exist yet - this can happen if verification link clicked before registration completed
        console.log(`[Auth Confirm-Sync] User not found for email: ${email}`);
        return res.status(200).json({ 
          message: "User not found", 
          exists: false, 
          emailVerified: false 
        });
      }

      // If user exists but email not verified, update it
      if (!user.emailVerified) {
        await storage.updateUser(user.id, {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        });
        console.log(`[Auth Confirm-Sync] Email verified for user: ${email} (id: ${user.id})`);
      }

      res.status(200).json({ 
        message: "ok", 
        exists: true,
        emailVerified: true,
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      });
    } catch (err) {
      console.error("[Auth Confirm-Sync] Error:", err);
      res.status(500).json({ message: "Ошибка синхронизации" });
    }
  });

  // Check email verification status (public endpoint)
  app.get("/api/auth/email-status", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ message: "Email required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // User doesn't exist - could be pre-registration
        return res.status(200).json({ 
          exists: false, 
          emailVerified: false 
        });
      }

      // Don't leak too much info - just the verification status
      res.status(200).json({ 
        exists: true,
        emailVerified: user.emailVerified || false
      });
    } catch (err) {
      console.error("[Auth Email-Status] Error:", err);
      res.status(500).json({ message: "Ошибка" });
    }
  });
}
