import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiGet, apiPost, apiPatch, safeFetch } from "@/lib/api-client";

export function useTracks() {
  return useQuery({
    queryKey: [api.tracks.list.path],
    queryFn: async () => {
      const response = await apiGet(api.tracks.list.path);
      if (!response.ok) {
        throw new Error(response.error?.message || "Failed to fetch tracks");
      }
      return api.tracks.list.responses[200].parse(response.data);
    },
  });
}

export function useTrack(id: number) {
  return useQuery({
    queryKey: [api.tracks.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.tracks.get.path, { id });
      const response = await apiGet(url);
      if (!response.ok) {
        throw new Error(response.error?.message || "Failed to fetch track");
      }
      return api.tracks.get.responses[200].parse(response.data);
    },
    enabled: !!id,
  });
}

export function useGenerateTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; description?: string; text: string; strictMode?: boolean }) => {
      const response = await apiPost(api.tracks.generate.path, data);
      if (!response.ok) {
        throw new Error(response.error?.message || "Failed to generate track");
      }
      return api.tracks.generate.responses[201].parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tracks.list.path] });
    },
  });
}

export function useJoinTrack() {
  return useMutation({
    mutationFn: async (code: string) => {
      const response = await apiPost(api.tracks.join.path, { code });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Invalid join code");
        }
        throw new Error(response.error?.message || "Failed to join track");
      }
      
      return api.tracks.join.responses[200].parse(response.data);
    },
  });
}

export function useEnrollments() {
  return useQuery({
    queryKey: [api.enrollments.list.path],
    queryFn: async () => {
      const response = await apiGet(api.enrollments.list.path);
      if (!response.ok) {
        throw new Error(response.error?.message || "Failed to fetch enrollments");
      }
      return api.enrollments.list.responses[200].parse(response.data);
    },
  });
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ trackId, stepIndex, completed }: { trackId: number; stepIndex: number; completed?: boolean }) => {
      const response = await apiPatch("/api/enrollments/progress", {
        trackId,
        stepIndex,
        isCompleted: completed,
      });
      if (!response.ok) {
        throw new Error(response.error?.message || "Failed to update progress");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.enrollments.list.path] });
    }
  });
}

export function useRecordDrill() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiPost(api.drills.record.path, data);
      if (!response.ok) {
        throw new Error(response.error?.message || "Failed to record drill");
      }
      return api.drills.record.responses[201].parse(response.data);
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stepId, content }: { stepId: number; content: any }) => {
      const response = await apiPatch(`/api/steps/${stepId}`, { content });
      if (!response.ok) {
        throw new Error(response.error?.message || "Failed to update step");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tracks.get.path] });
    }
  });
}

export function useCreateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { trackId: number; type: string; content: any; order: number }) => {
      const response = await apiPost("/api/steps", data);
      if (!response.ok) {
        throw new Error(response.error?.message || "Failed to create step");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tracks.get.path] });
    }
  });
}

export function useAddNeedsRepeatTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ trackId, tag }: { trackId: number; tag: string }) => {
      const response = await apiPost("/api/enrollments/needs-repeat", { trackId, tag });
      if (!response.ok) {
        throw new Error(response.error?.message || "Failed to add needs repeat tag");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.enrollments.list.path] });
    }
  });
}
