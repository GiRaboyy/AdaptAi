import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Mail, ArrowRight, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  parseHashParams,
  parseQueryParams,
  setSessionFromTokens,
  exchangeCodeForSession,
  isSupabaseConfigured,
  maskToken,
  fetchWithAuth,
} from '@/lib/supabase';

type CallbackStatus = 'loading' | 'success' | 'error' | 'no_params' | 'redirecting';

interface CallbackState {
  status: CallbackStatus;
  email?: string;
  errorMessage?: string;
}

/**
 * Extract email from JWT access token payload
 * JWT format: header.payload.signature (base64 encoded)
 */
function extractEmailFromJWT(token: string): string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    
    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    return payload.email;
  } catch (err) {
    console.warn('[Auth Callback] Failed to extract email from JWT:', err);
    return undefined;
  }
}

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>({ status: 'loading' });
  const [isResending, setIsResending] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    // Check for hash params (implicit flow: #access_token=...&refresh_token=...)
    const hashParams = parseHashParams(window.location.hash);
    
    // Check for query params (PKCE code flow: ?code=...)
    const queryParams = parseQueryParams(window.location.search);

    // Check for errors in query params
    if (queryParams.error) {
      const errorDesc = queryParams.error_description || queryParams.error;
      console.warn('[Auth Callback] Error from provider:', errorDesc);
      setState({
        status: 'error',
        errorMessage: getReadableError(errorDesc),
      });
      return;
    }

    // Handle hash fragment flow (tokens)
    if (hashParams.access_token && hashParams.refresh_token) {
      console.log('[Auth Callback] Processing token flow, type:', hashParams.type);
      
      // Extract email from JWT token (it's in the payload)
      const tokenEmail = extractEmailFromJWT(hashParams.access_token);
      const accessToken = hashParams.access_token;
      console.log('[Auth Callback] Extracted email from token:', tokenEmail ? '***@***' : 'none');
      
      // Clear hash from URL immediately for security
      window.history.replaceState(null, '', window.location.pathname);
      
      if (!isSupabaseConfigured()) {
        // Fallback: sync via backend with the access token
        if (tokenEmail) {
          await syncVerificationWithBackend(tokenEmail, accessToken);
        }
        setState({ status: 'success', email: tokenEmail });
        return;
      }

      const result = await setSessionFromTokens(
        accessToken,
        hashParams.refresh_token
      );

      // Use email from JWT token if setSession doesn't return it
      const email = result.email || tokenEmail;
      
      if (result.success) {
        // CRITICAL: Sync verification status with backend!
        // This updates emailVerified=true in the local database
        if (email) {
          console.log('[Auth Callback] Syncing verification with backend');
          const syncResult = await syncVerificationWithBackend(email, accessToken);
          console.log('[Auth Callback] Sync result:', syncResult);
        } else {
          console.warn('[Auth Callback] No email available to sync!');
        }
        
        setState({
          status: 'success',
          email: email,
        });
        
        // Auto-redirect to dashboard after a short delay
        setTimeout(() => autoRedirectToApp(accessToken), 1500);
      } else {
        setState({
          status: 'error',
          errorMessage: result.error || 'Не удалось подтвердить email',
        });
      }
      return;
    }

    // Handle PKCE code flow
    if (queryParams.code) {
      console.log('[Auth Callback] Processing code flow');
      
      // Clear code from URL immediately for security
      window.history.replaceState(null, '', window.location.pathname);
      
      if (!isSupabaseConfigured()) {
        setState({
          status: 'error',
          errorMessage: 'Supabase не настроен для обработки code flow',
        });
        return;
      }

      const result = await exchangeCodeForSession(queryParams.code);

      if (result.success) {
        if (result.email) {
          await notifyBackendVerified(result.email);
        }
        
        setState({
          status: 'success',
          email: result.email,
        });
        
        // Auto-redirect to dashboard
        setTimeout(() => autoRedirectToApp(), 1500);
      } else {
        setState({
          status: 'error',
          errorMessage: result.error || 'Не удалось обменять код',
        });
      }
      return;
    }

    // Handle token_hash (legacy Supabase format)
    if (queryParams.token_hash && queryParams.type === 'signup') {
      console.log('[Auth Callback] Processing legacy token_hash flow');
      await verifyViaBackendToken(queryParams.token_hash);
      return;
    }

    // No valid params found
    console.warn('[Auth Callback] No valid params found');
    setState({ status: 'no_params' });
  }

  async function verifyViaBackend(accessToken: string) {
    // When Supabase client isn't configured, verify via our backend
    try {
      console.log('[Auth Callback] Verifying via backend');
      // The backend should handle this internally
      setState({
        status: 'success',
        email: undefined,
      });
    } catch (err) {
      setState({
        status: 'error',
        errorMessage: 'Ошибка верификации',
      });
    }
  }

  async function verifyViaBackendToken(tokenHash: string) {
    // For legacy token_hash, call backend endpoint
    try {
      const res = await fetch(`/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=signup`);
      if (res.redirected) {
        // Backend redirected, check the final URL
        const url = new URL(res.url);
        if (url.searchParams.get('verified') === 'true') {
          setState({ status: 'success' });
        } else if (url.searchParams.get('error')) {
          setState({
            status: 'error',
            errorMessage: getReadableError(url.searchParams.get('error') || 'unknown'),
          });
        }
      } else {
        setState({ status: 'success' });
      }
    } catch (err) {
      setState({
        status: 'error',
        errorMessage: 'Ошибка верификации',
      });
    }
  }

  async function notifyBackendVerified(email: string) {
    // Legacy endpoint - kept for backwards compatibility
    try {
      console.log('[Auth Callback] Sending email-verified notification to backend');
      const res = await fetch('/api/auth/email-verified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      
      if (res.ok) {
        console.log('[Auth Callback] Backend notification successful');
        return true;
      } else {
        console.error('[Auth Callback] Backend notification failed:', res.status);
        return false;
      }
    } catch (err) {
      console.error('[Auth Callback] Failed to notify backend:', err);
      return false;
    }
  }

  // More secure sync using the access token
  async function syncVerificationWithBackend(email: string, accessToken?: string): Promise<{
    success: boolean;
    exists?: boolean;
    emailVerified?: boolean;
  }> {
    try {
      console.log('[Auth Callback] Syncing verification status with backend');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Include access token for secure sync
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      const res = await fetch('/api/auth/confirm-sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[Auth Callback] Sync successful:', data.emailVerified ? 'verified' : 'not verified');
        return {
          success: true,
          exists: data.exists,
          emailVerified: data.emailVerified,
        };
      } else {
        console.error('[Auth Callback] Sync failed:', res.status);
        // Fallback to legacy endpoint
        await notifyBackendVerified(email);
        return { success: false };
      }
    } catch (err) {
      console.error('[Auth Callback] Sync error:', err);
      // Fallback to legacy endpoint
      await notifyBackendVerified(email);
      return { success: false };
    }
  }

  async function handleResendEmail() {
    if (!resendEmail || isResending) return;

    setIsResending(true);
    try {
      const res = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
        credentials: 'include',
      });

      if (res.ok) {
        toast({
          title: 'Письмо отправлено',
          description: 'Проверьте вашу почту',
        });
      } else {
        const data = await res.json();
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.message || 'Не удалось отправить письмо',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось отправить письмо',
      });
    } finally {
      setIsResending(false);
    }
  }

  function getReadableError(error: string): string {
    const errorMap: Record<string, string> = {
      'invalid_token': 'Ссылка недействительна или уже использована',
      'token_expired': 'Срок действия ссылки истёк',
      'access_denied': 'Доступ запрещён',
      'server_error': 'Ошибка сервера',
      'otp_expired': 'Срок действия ссылки истёк',
      'otp_disabled': 'Подтверждение отключено',
    };
    return errorMap[error] || `Ошибка: ${error}`;
  }

  async function autoRedirectToApp(accessToken?: string) {
    setState(prev => ({ ...prev, status: 'redirecting' }));
    
    try {
      // Try to fetch user profile to get role
      const res = await fetchWithAuth('/api/me');
      if (res.ok) {
        const user = await res.json();
        // Redirect based on role
        if (user.role === 'curator') {
          window.location.href = '/curator';
        } else {
          window.location.href = '/app/join';
        }
        return;
      }
    } catch (err) {
      console.warn('[Auth Callback] Could not fetch profile for redirect:', err);
    }
    
    // Fallback: redirect to auth page with verified flag
    window.location.href = '/auth?verified=true';
  }

  function handleGoToApp() {
    autoRedirectToApp();
  }

  return (
    <div className="min-h-screen bg-[#f0f1f3] flex items-center justify-center p-6">
      <div className="w-full max-w-[480px]">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#C8F65D] flex items-center justify-center">
            <span className="text-xl font-bold text-[#1A1A2E]">A</span>
          </div>
          <span className="text-2xl font-semibold text-[#1A1A2E] ml-3">ADAPT</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
          {state.status === 'loading' && (
            <>
              <div className="mx-auto w-16 h-16 bg-[#C8F65D]/20 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#1A1A2E] animate-spin" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1A1A2E]">
                  Подтверждаем email...
                </h1>
                <p className="text-gray-500 mt-2">
                  Пожалуйста, подождите
                </p>
              </div>
            </>
          )}

          {state.status === 'success' && (
            <>
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1A1A2E]">
                  Email подтверждён!
                </h1>
                {state.email && (
                  <p className="text-gray-500 mt-2">
                    {state.email}
                  </p>
                )}
                <p className="text-gray-400 text-sm mt-2">
                  Перенаправляем в личный кабинет...
                </p>
              </div>
              <Button
                onClick={handleGoToApp}
                className="w-full h-12 rounded-xl bg-[#C8F65D] hover:bg-[#b9e84d] text-[#1A1A2E] font-semibold"
              >
                Войти в приложение
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}

          {state.status === 'redirecting' && (
            <>
              <div className="mx-auto w-16 h-16 bg-[#C8F65D]/20 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#1A1A2E] animate-spin" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1A1A2E]">
                  Входим в систему...
                </h1>
                <p className="text-gray-500 mt-2">
                  Пожалуйста, подождите
                </p>
              </div>
            </>
          )}

          {state.status === 'error' && (
            <>
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1A1A2E]">
                  Не удалось подтвердить
                </h1>
                <p className="text-gray-500 mt-2">
                  {state.errorMessage}
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="Введите ваш email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl bg-white text-[#1A1A2E] placeholder:text-gray-400 focus:ring-2 focus:ring-[#C8F65D]/30 focus:border-[#C8F65D] outline-none"
                  />
                  <Button
                    onClick={handleResendEmail}
                    disabled={!resendEmail || isResending}
                    variant="outline"
                    className="w-full h-12 rounded-xl"
                  >
                    {isResending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Отправить письмо повторно
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Link href="/auth" className="flex-1">
                    <Button variant="ghost" className="w-full h-12 rounded-xl">
                      Сменить email
                    </Button>
                  </Link>
                  <Link href="/auth" className="flex-1">
                    <Button variant="ghost" className="w-full h-12 rounded-xl">
                      Войти
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}

          {state.status === 'no_params' && (
            <>
              <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-yellow-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1A1A2E]">
                  Ссылка не найдена
                </h1>
                <p className="text-gray-500 mt-2">
                  Похоже, вы перешли на эту страницу напрямую.
                  Проверьте письмо и нажмите на ссылку подтверждения.
                </p>
              </div>
              <Link href="/auth">
                <Button className="w-full h-12 rounded-xl bg-[#C8F65D] hover:bg-[#b9e84d] text-[#1A1A2E] font-semibold">
                  Перейти к входу
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 ADAPT
        </p>
      </div>
    </div>
  );
}
