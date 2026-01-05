import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useTracks() {
  return useQuery({
    queryKey: [api.tracks.list.path],
    queryFn: async () => {
      const res = await fetch(api.tracks.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tracks");
      return api.tracks.list.responses[200].parse(await res.json());
    },
  });
}

export function useTrack(id: number) {
  return useQuery({
    queryKey: [api.tracks.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.tracks.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch track");
      return api.tracks.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useGenerateTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; description?: string; text: string; strictMode?: boolean }) => {
      const res = await fetch(api.tracks.generate.path, {
        method: api.tracks.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate track");
      return api.tracks.generate.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tracks.list.path] });
    },
  });
}

export function useJoinTrack() {
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(api.tracks.join.path, {
        method: api.tracks.join.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "include",
      });
      
      if (res.status === 404) throw new Error("Invalid join code");
      if (!res.ok) throw new Error("Failed to join track");
      
      return api.tracks.join.responses[200].parse(await res.json());
    },
  });
}

export function useEnrollments() {
  return useQuery({
    queryKey: [api.enrollments.list.path],
    queryFn: async () => {
      const res = await fetch(api.enrollments.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      return api.enrollments.list.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ trackId, stepIndex, completed }: { trackId: number; stepIndex: number; completed?: boolean }) => {
      const res = await fetch("/api/enrollments/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, stepIndex, isCompleted: completed }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update progress");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.enrollments.list.path] });
    }
  });
}

export function useRecordDrill() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.drills.record.path, {
        method: api.drills.record.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to record drill");
      return api.drills.record.responses[201].parse(await res.json());
    },
  });
}
