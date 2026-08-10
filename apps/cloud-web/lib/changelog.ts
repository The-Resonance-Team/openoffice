export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  dateShort: string;
  title: string;
  body: string;
  url: string;
}

const GITHUB_REPO = 'openoffice/openoffice';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

function formatRelease(release: GitHubRelease): ChangelogEntry {
  const date = new Date(release.published_at);
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const dateShort = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return {
    version: release.tag_name,
    date: dateStr,
    dateShort,
    title: release.name || release.tag_name,
    body: release.body,
    url: release.html_url,
  };
}

export async function fetchChangelog(): Promise<ChangelogEntry[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'openoffice-cloud-web',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${GITHUB_API}?per_page=30`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error(`GitHub API error: ${res.status}`);
      return [];
    }

    const releases: GitHubRelease[] = await res.json();
    return releases.filter((r) => !r.draft && !r.prerelease).map(formatRelease);
  } catch (error) {
    console.error('Failed to fetch changelog:', error);
    return [];
  }
}
