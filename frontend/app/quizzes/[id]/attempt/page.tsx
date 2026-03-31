"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getQuestions, submitAnswer, completeAttempt, Question, Answer } from "@/lib/api";

export default function AttemptPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attempt")!;
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getQuestions(id).then(setQuestions).catch(console.error);
  }, [id]);

  const question = questions[current];

  const handleSubmitAnswer = useCallback(async (value: string) => {
    if (!question || submitting) return;
    setSubmitting(true);
    try {
      const answer = await submitAnswer(attemptId, {
        question_id: question.id,
        user_answer: value,
      });
      setAnswers((prev) => ({ ...prev, [question.id]: answer }));
      setSubmitted(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }, [question, attemptId, submitting]);

  async function handleNext() {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      setInput("");
      setSubmitted(false);
    } else {
      await completeAttempt(attemptId);
      router.push(`/quizzes/${id}/results?attempt=${attemptId}`);
    }
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading questions...</p>
        </div>
      </div>
    );
  }

  const currentAnswer = answers[question.id];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 bg-gray-800 rounded-full h-2">
            <div
              className="bg-violet-500 h-2 rounded-full transition-all"
              style={{ width: `${((current + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className="text-sm text-gray-400">{current + 1} / {questions.length}</span>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
              {question.question_type === "multiple_choice" ? "Multiple Choice" : "Short Answer"} · {question.source_file}
            </p>
            <h2 className="text-xl font-medium leading-relaxed">{question.question_text}</h2>
          </div>

          {!submitted ? (
            question.question_type === "multiple_choice" && question.choices ? (
              <div className="space-y-3">
                {question.choices.map((choice) => (
                  <button
                    key={choice.label}
                    onClick={() => handleSubmitAnswer(choice.label)}
                    disabled={submitting}
                    className="w-full text-left px-5 py-3 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-violet-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <span className="font-medium text-violet-400 mr-3">{choice.label}.</span>
                    {choice.text}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
                <button
                  onClick={() => handleSubmitAnswer(input)}
                  disabled={!input.trim() || submitting}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {currentAnswer && currentAnswer.grading_status === "graded" ? (
                <div className={`p-4 rounded-lg border ${currentAnswer.is_correct ? "bg-green-950 border-green-700" : "bg-red-950 border-red-700"}`}>
                  <p className="font-medium mb-1">
                    {currentAnswer.is_correct ? "Correct!" : "Incorrect"}
                  </p>
                  {currentAnswer.ai_feedback && (
                    <p className="text-sm text-gray-300">{currentAnswer.ai_feedback}</p>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-gray-900 border border-gray-700">
                  <p className="text-gray-400 text-sm">Grading your answer...</p>
                </div>
              )}
              <button
                onClick={handleNext}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg font-medium transition-colors"
              >
                {current < questions.length - 1 ? "Next Question" : "Finish Quiz"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
