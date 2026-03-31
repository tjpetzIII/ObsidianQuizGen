import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white px-4">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">ObsidianQuiz</h1>
        <p className="text-xl text-gray-400">
          Automatically generate quizzes from your Obsidian notes and test your knowledge.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-medium transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
