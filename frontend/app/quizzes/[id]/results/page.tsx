"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getAttempt, getAnswers, getQuestions, Attempt, Answer, Question } from "@/lib/api";

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attempt")!;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    async function load() {
      const [a, ans, qs] = await Promise.all([
        getAttempt(attemptId),
        getAnswers(attemptId),
        getQuestions(id),
      ]);
      setAttempt(a);
      setAnswers(ans);
      setQuestions(qs);
    }
    load();
  }, [attemptId, id]);

  const questionMap = Object.fromEntries(questions.map((q) => [q.id, q]));
  const scorePercent = attempt?.score != null ? Math.round(attempt.score * 100) : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Quiz Results</h1>
          {scorePercent != null && (
            <p className="text-5xl font-bold text-violet-400">{scorePercent}%</p>
          )}
          <p className="text-gray-400">
            {answers.filter((a) => a.is_correct).length} / {answers.length} correct
          </p>
        </div>

        <div className="space-y-4">
          {answers.map((answer) => {
            const q = questionMap[answer.question_id];
            return (
              <div
                key={answer.id}
                className={`p-5 rounded-xl border ${
                  answer.is_correct === true
                    ? "bg-green-950 border-green-800"
                    : answer.is_correct === false
                    ? "bg-red-950 border-red-800"
                    : "bg-gray-900 border-gray-800"
                }`}
              >
                {q && <p className="font-medium mb-2">{q.question_text}</p>}
                <p className="text-sm text-gray-400 mb-1">
                  Your answer: <span className="text-white">{answer.user_answer}</span>
                </p>
                {answer.ai_feedback && (
                  <p className="text-sm text-gray-300 mt-2">{answer.ai_feedback}</p>
                )}
                {answer.grading_status === "pending" && (
                  <p className="text-sm text-yellow-400 mt-1">Grading in progress...</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/dashboard" className="px-5 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors">
            Back to Dashboard
          </Link>
          <Link href={`/quizzes/${id}`} className="px-5 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg font-medium transition-colors">
            Retry Quiz
          </Link>
        </div>
      </div>
    </div>
  );
}
