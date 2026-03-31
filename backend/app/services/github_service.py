import httpx
from datetime import datetime, timezone
from dataclasses import dataclass
from app.config import settings


@dataclass
class FileChange:
    filename: str
    patch: str
    commit_message: str
    commit_date: str
    additions: int
    deletions: int


async def get_note_changes(
    repo_owner: str,
    repo_name: str,
    file_prefix: str,
    hours_lookback: int,
) -> list[FileChange]:
    since = datetime.now(timezone.utc).replace(
        hour=datetime.now(timezone.utc).hour - hours_lookback
        if datetime.now(timezone.utc).hour >= hours_lookback
        else 0
    )
    # Simpler: just subtract timedelta
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(hours=hours_lookback)

    headers = {
        "Authorization": f"token {settings.github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        # Fetch commits since the lookback window
        commits_resp = await client.get(
            f"https://api.github.com/repos/{repo_owner}/{repo_name}/commits",
            params={"since": since.isoformat()},
        )
        commits_resp.raise_for_status()
        commits = commits_resp.json()

        if not commits:
            return []

        changes: list[FileChange] = []
        seen_files: set[str] = set()

        for commit in commits:
            sha = commit["sha"]
            commit_message = commit["commit"]["message"]
            commit_date = commit["commit"]["committer"]["date"]

            detail_resp = await client.get(
                f"https://api.github.com/repos/{repo_owner}/{repo_name}/commits/{sha}"
            )
            detail_resp.raise_for_status()
            detail = detail_resp.json()

            for file in detail.get("files", []):
                filename = file["filename"]
                basename = filename.split("/")[-1]
                if not basename.startswith(file_prefix):
                    continue
                if filename in seen_files:
                    continue
                seen_files.add(filename)

                patch = file.get("patch", "")
                if not patch:
                    continue

                changes.append(
                    FileChange(
                        filename=filename,
                        patch=patch,
                        commit_message=commit_message,
                        commit_date=commit_date,
                        additions=file.get("additions", 0),
                        deletions=file.get("deletions", 0),
                    )
                )

        return changes
