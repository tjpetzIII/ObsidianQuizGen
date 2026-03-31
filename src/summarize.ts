import "dotenv/config";
import { Octokit } from "@octokit/rest";
import { execFileSync } from "child_process";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable is not set.");
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const REPO_OWNER = "tjpetzIII";
const REPO_NAME = "Personal-Vault";
const LN_FILE_PATTERN = /^LN/;
const HOURS_LOOKBACK = 24;

interface FileChange {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  patch?: string;
  commitSha: string;
  commitMessage: string;
  commitDate: string;
}

async function getRecentCommits(since: Date): Promise<string[]> {
  const { data } = await octokit.rest.repos.listCommits({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    since: since.toISOString(),
    per_page: 100,
  });
  return data.map((c) => c.sha);
}

async function getLNFileChanges(commitShas: string[]): Promise<FileChange[]> {
  const changes: FileChange[] = [];

  for (const sha of commitShas) {
    const { data } = await octokit.rest.repos.getCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: sha,
    });

    const message = data.commit.message;
    const date = data.commit.author?.date ?? new Date().toISOString();

    for (const file of data.files ?? []) {
      const basename = file.filename.split("/").pop() ?? file.filename;
      if (!LN_FILE_PATTERN.test(basename)) continue;

      changes.push({
        filename: file.filename,
        status: file.status as FileChange["status"],
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        commitSha: sha.slice(0, 7),
        commitMessage: message,
        commitDate: date,
      });
    }
  }

  return changes;
}

function buildPrompt(changes: FileChange[]): string {
  const sections = changes.map((c) => {
    const lines = [
      `## File: ${c.filename}`,
      `Commit: ${c.commitSha} — "${c.commitMessage}" (${c.commitDate})`,
      `Status: ${c.status} (+${c.additions} lines, -${c.deletions} lines)`,
    ];
    if (c.patch) {
      lines.push("", "```diff", c.patch, "```");
    } else {
      lines.push("(no text diff available — file may be binary or unchanged)");
    }
    return lines.join("\n");
  });

  return [
    'The following changes were made to Obsidian vault notes with filenames starting with "LN"',
    "(Learning Notes) in the past 24 hours. Please provide a concise, human-readable summary",
    "of what was added, changed, or removed across these files. Focus on the actual content",
    "changes, not the technical git details.",
    "",
    ...sections,
  ].join("\n");
}

function summarizeWithClaude(prompt: string): string {
  const systemPrompt =
    "You are a helpful assistant that summarizes changes to personal knowledge base notes. " +
    "Provide clear, concise summaries focused on what knowledge was added or updated.";
  const fullPrompt = `${systemPrompt}\n\n${prompt}`;

  return execFileSync("claude", ["--print"], {
    input: fullPrompt,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  });
}

async function main(): Promise<void> {
  const since = new Date(Date.now() - HOURS_LOOKBACK * 60 * 60 * 1000);
  console.log(`Fetching commits since: ${since.toISOString()}\n`);

  const commitShas = await getRecentCommits(since);
  console.log(`Found ${commitShas.length} commit(s) in the past ${HOURS_LOOKBACK} hours.`);

  if (commitShas.length === 0) {
    console.log("No recent commits found. Nothing to summarize.");
    return;
  }

  const changes = await getLNFileChanges(commitShas);
  console.log(`Found ${changes.length} LN file change(s) to summarize.\n`);

  if (changes.length === 0) {
    console.log("No changes to LN-prefixed files in the past 24 hours.");
    return;
  }

  console.log("Generating summary with Claude...\n");
  const prompt = buildPrompt(changes);
  const summary = summarizeWithClaude(prompt);

  console.log("=".repeat(60));
  console.log("SUMMARY OF RECENT LN FILE CHANGES");
  console.log("=".repeat(60));
  console.log(summary);
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
