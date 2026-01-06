import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertUser } from "@shared/routes";
import { useLocation } from "wouter";

export function useUser() {
  return useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
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
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const mutation = useMutation({
    mutationFn: async (data: InsertUser) => {
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
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      if (user.role === 'curator') {
        setLocation("/curator");
      } else {
        setLocation("/app/join");
      }
    },
  });

  return {
    register: mutation.mutate,
    isPending: mutation.isPending
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async () => {
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
