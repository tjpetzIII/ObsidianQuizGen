"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function Navbar() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-gray-800 bg-gray-950 px-6 py-4 flex items-center justify-between">
      <Link href="/dashboard" className="text-lg font-semibold text-white">
        ObsidianQuiz
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/profile" className="text-sm text-gray-400 hover:text-white transition-colors">
          Profile
        </Link>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
