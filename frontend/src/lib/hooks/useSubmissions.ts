import { useMutation, useQuery } from "@tanstack/react-query";
import {
  submitSolution,
  fetchSubmissions,
  fetchSubmissionById,
  type SubmissionPayload,
} from "../api/submissions";

export function useSubmitSolution() {
  return useMutation({
    mutationFn: (payload: SubmissionPayload) => submitSolution(payload),
    onError: (error: Error) => {
      console.error("Submission error:", error.message);
    },
  });
}

export function useAdminSubmissions() {
  return useQuery({
    queryKey: ["submissions"],
    queryFn: fetchSubmissions,
    staleTime: 1000 * 60,
  });
}

export function useSubmission(id: string) {
  return useQuery({
    queryKey: ["submission", id],
    queryFn: () => fetchSubmissionById(id),
    enabled: !!id,
  });
}
