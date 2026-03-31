import { createClient } from "./supabase";

const API_URL = "/api";

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Failed to get session:", error.message);
    return null;
  }
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const getMe = () => request<Profile>("/auth/me");

// Profile
export const getProfile = () => request<Profile>("/profile");
export const updateProfile = (data: Partial<Profile>) =>
  request<Profile>("/profile", { method: "PUT", body: JSON.stringify(data) });

// Quizzes
export const createQuiz = (data: { hours_lookback: number; num_questions: number }) =>
  request<Quiz>("/quizzes", { method: "POST", body: JSON.stringify(data) });
export const listQuizzes = () => request<Quiz[]>("/quizzes");
export const getQuiz = (id: string) => request<Quiz>(`/quizzes/${id}`);
export const deleteQuiz = (id: string) => request<void>(`/quizzes/${id}`, { method: "DELETE" });
export const getQuestions = (quizId: string) =>
  request<Question[]>(`/quizzes/${quizId}/questions`);

// Attempts
export const startAttempt = (quizId: string) =>
  request<Attempt>(`/quizzes/${quizId}/attempts`, { method: "POST" });
export const getAttempt = (attemptId: string) => request<Attempt>(`/attempts/${attemptId}`);
export const completeAttempt = (attemptId: string) =>
  request<Attempt>(`/attempts/${attemptId}/complete`, { method: "POST" });
export const submitAnswer = (attemptId: string, data: { question_id: string; user_answer: string }) =>
  request<Answer>(`/attempts/${attemptId}/answers`, { method: "POST", body: JSON.stringify(data) });
export const getAnswers = (attemptId: string) =>
  request<Answer[]>(`/attempts/${attemptId}/answers`);

// Types
export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  repo_owner?: string;
  repo_name?: string;
  file_prefix?: string;
}

export interface Quiz {
  id: string;
  user_id: string;
  title: string;
  source_files: string[];
  hours_lookback: number;
  status: "generating" | "ready" | "error";
  error_message?: string;
  created_at: string;
  generated_at?: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: "multiple_choice" | "free_text";
  choices?: { label: string; text: string }[];
  position: number;
  source_file: string;
}

export interface Attempt {
  id: string;
  quiz_id: string;
  user_id: string;
  status: "in_progress" | "completed";
  score?: number;
  started_at: string;
  completed_at?: string;
}

export interface Answer {
  id: string;
  attempt_id: string;
  question_id: string;
  user_answer: string;
  is_correct?: boolean;
  ai_feedback?: string;
  grading_status: "pending" | "graded";
  submitted_at: string;
}
