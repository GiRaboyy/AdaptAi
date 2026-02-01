import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertUser } from "@shared/routes";
import { useLocation } from "wouter";
import { getSupabaseClient, fetchWithAuth } from "@/lib/supabase";

export function useUser() {
  return useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      // Use fetchWithAuth to automatically include JWT token
      const res = await fetchWithAuth(api.auth.me.path);
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return api.auth.me.responses[200].parse(await res.json());
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const mutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        // Fallback to legacy auth if Supabase not configured
        const res = await fetch(api.auth.login.path, {
          method: api.auth.login.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
          credentials: "include",
        });
        
        if (!res.ok) {
          try {
            const error = await res.json();
            throw new Error(error.message || "Ошибка входа");
          } catch (e) {
            if (e instanceof SyntaxError) {
              throw new Error("Ошибка входа");
            }
            throw e;
          }
        }
        
        return api.auth.login.responses[200].parse(await res.json());
      }

      // Use Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.username,
        password: credentials.password,
      });

      if (error) {
        // Check for specific error codes
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Email не подтверждён. Проверьте почту.');
        }
        throw new Error(error.message || 'Ошибка входа');
      }

      if (!data.user) {
        throw new Error('Не удалось войти');
      }

      // Fetch user profile from our backend
      const profileRes = await fetchWithAuth(api.auth.me.path);
      if (!profileRes.ok) {
        throw new Error('Не удалось загрузить профиль');
      }

      return await profileRes.json();
    },
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData([api.auth.me.path], user);
      if (user.role === 'curator') {
        setLocation("/curator");
      } else {
        setLocation("/app/join");
      }
    },
  });

  return {
    login: mutation.mutateAsync,
    isPending: mutation.isPending
  };
}

export function useRegister() {
  const mutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        // Fallback to legacy registration
        const res = await fetch(api.auth.register.path, {
          method: api.auth.register.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status === 400) {
            const error = api.auth.register.responses[400].parse(await res.json());
            throw new Error(error.message);
          }
          throw new Error("Registration failed");
        }

        return api.auth.register.responses[201].parse(await res.json());
      }

      // Use Supabase Auth for registration
      const appUrl = (import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin;
      const redirectUrl = `${appUrl}/auth/callback`;
      
      // Ensure password is provided for Supabase signup
      if (!data.password) {
        throw new Error('Пароль обязателен');
      }
      
      const signUpOptions: any = {
        data: {
          name: data.name,
          role: data.role,
        },
      };
      
      if (redirectUrl) {
        signUpOptions.emailRedirectTo = redirectUrl;
      }
      
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: signUpOptions,
      });

      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('Пользователь уже зарегистрирован. Войдите.');
        }
        throw new Error(error.message || 'Ошибка регистрации');
      }

      if (!authData.user) {
        throw new Error('Не удалось создать аккаунт');
      }

      // Return user data for verification screen
      return {
        user: {
          id: 0, // Will be assigned by backend
          email: data.email,
          name: data.name,
          role: data.role,
          emailVerified: false,
        },
        message: "Проверьте почту для подтверждения email",
        needsVerification: true,
      };
    },
    // No auto-redirect - let the component handle showing verification screen
  });

  return {
    register: mutation.mutate,
    registerAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    data: mutation.data,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseClient();
      
      // Sign out from Supabase if available
      if (supabase) {
        await supabase.auth.signOut();
      }

      // Also call backend logout for session cleanup
      await fetch(api.auth.logout.path, { 
        method: api.auth.logout.method,
        credentials: "include" 
      });
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/");
    },
  });
}
