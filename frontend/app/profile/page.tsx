"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { getProfile, updateProfile, Profile } from "@/lib/api";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile).catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateProfile({
        display_name: profile.display_name,
        repo_owner: profile.repo_owner,
        repo_name: profile.repo_name,
        file_prefix: profile.file_prefix,
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function field(key: keyof Profile, label: string, placeholder: string) {
    return (
      <div>
        <label className="block text-sm text-gray-400 mb-1">{label}</label>
        <input
          type="text"
          value={(profile?.[key] as string) ?? ""}
          placeholder={placeholder}
          onChange={(e) => setProfile((p) => p ? { ...p, [key]: e.target.value } : p)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>
        {!profile ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {field("display_name", "Display name", "Your name")}
            <hr className="border-gray-800" />
            <p className="text-sm text-gray-500">GitHub repository containing your Obsidian vault</p>
            {field("repo_owner", "GitHub username / org", "octocat")}
            {field("repo_name", "Repository name", "my-obsidian-vault")}
            {field("file_prefix", "Note file prefix", "LN")}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              {saved && <span className="text-green-400 text-sm">Saved!</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
