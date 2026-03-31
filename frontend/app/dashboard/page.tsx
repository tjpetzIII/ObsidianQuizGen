"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { listQuizzes, createQuiz, deleteQuiz, Quiz } from "@/lib/api";
import { createClient } from "@/lib/supabase";

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [hoursLookback, setHoursLookback] = useState(24);
  const [numQuestions, setNumQuestions] = useState(10);
  const [ready, setReady] = useState(false);

  async function loadQuizzes() {
    try {
      const data = await listQuizzes();
      setQuizzes(data);
    } catch {
      // handled below
    } finally {
      setLoading(false);
    }
  }

  // Wait for Supabase session before making API calls
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    loadQuizzes();
    const interval = setInterval(async () => {
      const data = await listQuizzes().catch(() => []);
      setQuizzes(data);
    }, 5000);
    return () => clearInterval(interval);
  }, [ready]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setShowForm(false);
    try {
      const quiz = await createQuiz({ hours_lookback: hoursLookback, num_questions: numQuestions });
      setQuizzes((prev) => [quiz, ...prev]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this quiz?")) return;
    await deleteQuiz(id);
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Your Quizzes</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg font-medium transition-colors"
          >
            + New Quiz
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleGenerate} className="mb-8 p-6 bg-gray-900 rounded-xl space-y-4 border border-gray-800">
            <h2 className="font-semibold text-lg">Generate Quiz from Notes</h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Hours lookback: <span className="text-white">{hoursLookback}h</span>
              </label>
              <input
                type="range" min={4} max={168} value={hoursLookback}
                onChange={(e) => setHoursLookback(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Number of questions: <span className="text-white">{numQuestions}</span>
              </label>
              <input
                type="range" min={5} max={20} value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={generating} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg font-medium transition-colors">
                {generating ? "Generating..." : "Generate"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-gray-500">Loading quizzes...</p>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No quizzes yet.</p>
            <p className="text-sm mt-2">Generate your first quiz from your Obsidian notes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="p-5 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{quiz.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(quiz.created_at).toLocaleDateString()} ·{" "}
                    {quiz.status === "generating" && <span className="text-yellow-400">Generating...</span>}
                    {quiz.status === "ready" && <span className="text-green-400">Ready</span>}
                    {quiz.status === "error" && <span className="text-red-400">Error: {quiz.error_message}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {quiz.status === "ready" && (
                    <Link href={`/quizzes/${quiz.id}`} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors">
                      Start
                    </Link>
                  )}
                  <button onClick={() => handleDelete(quiz.id)} className="px-3 py-1.5 bg-gray-800 hover:bg-red-900 rounded-lg text-sm transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
