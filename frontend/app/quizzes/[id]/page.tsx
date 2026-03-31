"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getQuiz, getQuestions, startAttempt, Quiz, Question } from "@/lib/api";

export default function QuizDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function load() {
      const q = await getQuiz(id);
      setQuiz(q);
      if (q.status === "ready") {
        const qs = await getQuestions(id);
        setQuestions(qs);
      }
    }
    load();

    const interval = setInterval(async () => {
      const q = await getQuiz(id);
      setQuiz(q);
      if (q.status === "ready") {
        const qs = await getQuestions(id);
        setQuestions(qs);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  async function handleStart() {
    setStarting(true);
    try {
      const attempt = await startAttempt(id);
      router.push(`/quizzes/${id}/attempt?attempt=${attempt.id}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to start");
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        {!quiz ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">{quiz.title}</h1>
            <div className="flex items-center gap-2">
              {quiz.status === "generating" && (
                <span className="px-3 py-1 bg-yellow-900 text-yellow-300 rounded-full text-sm">
                  Generating questions...
                </span>
              )}
              {quiz.status === "ready" && (
                <span className="px-3 py-1 bg-green-900 text-green-300 rounded-full text-sm">
                  {questions.length} questions ready
                </span>
              )}
              {quiz.status === "error" && (
                <span className="px-3 py-1 bg-red-900 text-red-300 rounded-full text-sm">
                  Error: {quiz.error_message}
                </span>
              )}
            </div>

            {quiz.source_files.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Source files:</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  {quiz.source_files.map((f) => (
                    <li key={f} className="font-mono">{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {quiz.status === "ready" && (
              <button
                onClick={handleStart}
                disabled={starting}
                className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {starting ? "Starting..." : "Start Quiz"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
