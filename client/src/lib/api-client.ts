import { getSupabaseClient } from './supabase';

/**
 * Centralized API Client for AdaptAI
 * 
 * Features:
 * - Automatic JWT token injection from Supabase session
 * - Safe JSON parsing with HTML error fallback
 * - Consistent error handling across all API calls
 * - Request/response logging in development
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface SafeFetchOptions extends RequestInit {
  skipAuth?: boolean; // Skip adding auth headers (for public endpoints)
}

/**
 * Safe fetch wrapper with automatic auth and error handling
 * 
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Structured API response
 */
export async function safeFetch<T = any>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<ApiResponse<T>> {
  const isDev = import.meta.env.DEV;
  
  try {
    // Get auth headers from Supabase session
    const authHeaders: HeadersInit = {};
    
    if (!options.skipAuth) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            authHeaders['Authorization'] = `Bearer ${session.access_token}`;
            if (isDev) {
              console.log(`[API Client] Adding auth header for ${url}`);
            }
          }
        } catch (err) {
          if (isDev) {
            console.warn('[API Client] Failed to get auth token:', err);
          }
        }
      }
    }

    // Merge headers
    const headers: HeadersInit = {
      ...authHeaders,
      ...options.headers,
    };

    // Add credentials for cookie-based auth fallback
    const fetchOptions: RequestInit = {
      ...options,
      headers,
      credentials: options.credentials || 'include',
    };

    if (isDev) {
      console.log(`[API Client] ${options.method || 'GET'} ${url}`);
    }

    // Execute request
    const response = await fetch(url, fetchOptions);
    const status = response.status;

    // Get content type
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (isDev) {
      console.log(`[API Client] Response: ${status} ${isJson ? 'JSON' : contentType}`);
    }

    // Handle successful JSON response
    if (response.ok && isJson) {
      const data = await response.json();
      return {
        ok: true,
        status,
        data,
      };
    }

    // Handle error JSON response
    if (!response.ok && isJson) {
      const errorData = await response.json();
      return {
        ok: false,
        status,
        error: {
          code: errorData.code || errorData.errorCode || 'API_ERROR',
          message: errorData.message || 'Произошла ошибка',
        },
      };
    }

    // Handle HTML error page (Vercel edge errors)
    if (!isJson) {
      const textBody = await response.text();
      const isHtml = textBody.trim().startsWith('<');
      
      if (isDev) {
        console.warn('[API Client] Received non-JSON response:', textBody.substring(0, 200));
      }

      return {
        ok: false,
        status,
        error: {
          code: 'NON_JSON_RESPONSE',
          message: isHtml 
            ? getHtmlErrorMessage(status) 
            : textBody.substring(0, 100),
        },
      };
    }

    // Fallback for unexpected cases
    return {
      ok: false,
      status,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Неожиданная ошибка',
      },
    };

  } catch (err) {
    // Network error or request failed
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    if (isDev) {
      console.error('[API Client] Request failed:', errorMessage);
    }

    return {
      ok: false,
      status: 0,
      error: {
        code: 'NETWORK_ERROR',
        message: errorMessage.includes('fetch')
          ? 'Проверьте интернет-соединение'
          : errorMessage,
      },
    };
  }
}

/**
 * Get user-friendly error message for HTML error pages
 */
function getHtmlErrorMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Сессия истекла. Войдите снова.';
    case 403:
      return 'Доступ запрещён';
    case 404:
      return 'Ресурс не найден';
    case 500:
      return 'Ошибка сервера. Попробуйте позже.';
    case 502:
    case 503:
      return 'Сервер временно недоступен';
    case 504:
      return 'Превышено время ожидания';
    default:
      return 'Ошибка обработки запроса';
  }
}

/**
 * Helper for GET requests
 */
export async function apiGet<T = any>(url: string, options?: SafeFetchOptions): Promise<ApiResponse<T>> {
  return safeFetch<T>(url, { ...options, method: 'GET' });
}

/**
 * Helper for POST requests with JSON body
 */
export async function apiPost<T = any>(
  url: string,
  body?: any,
  options?: SafeFetchOptions
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  return safeFetch<T>(url, {
    ...options,
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Helper for PATCH requests with JSON body
 */
export async function apiPatch<T = any>(
  url: string,
  body?: any,
  options?: SafeFetchOptions
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  return safeFetch<T>(url, {
    ...options,
    method: 'PATCH',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Helper for DELETE requests
 */
export async function apiDelete<T = any>(url: string, options?: SafeFetchOptions): Promise<ApiResponse<T>> {
  return safeFetch<T>(url, { ...options, method: 'DELETE' });
}

/**
 * Helper for FormData uploads (multipart/form-data)
 * Note: Do NOT set Content-Type header - browser sets it with boundary
 */
export async function apiPostForm<T = any>(
  url: string,
  formData: FormData,
  options?: SafeFetchOptions
): Promise<ApiResponse<T>> {
  return safeFetch<T>(url, {
    ...options,
    method: 'POST',
    body: formData,
    // Note: headers intentionally omitted for FormData
  });
}
