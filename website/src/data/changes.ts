import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repositoryRoot = findRepositoryRoot(process.cwd());
const repositoryUrl = "https://github.com/Utility-Gods/gruntend";

export interface ChangeReference {
  commit?: string;
  text: string;
}

export interface PendingChange {
  date?: string;
  groups: Array<{
    label: string;
    changes: ChangeReference[];
  }>;
  id: string;
  packages: Array<{
    name: string;
    type: "major" | "minor" | "patch";
  }>;
  sourceUrl: string;
}

export interface ReleasedChange {
  date?: string;
  groups: Array<{
    label: string;
    changes: ChangeReference[];
  }>;
  sourceUrl: string;
  version: string;
}

function findRepositoryRoot(startDirectory: string): string {
  let directory = path.resolve(startDirectory);

  while (true) {
    const changelogPath = path.join(directory, "CHANGELOG.md");
    const changesetConfigPath = path.join(
      directory,
      ".changeset",
      "config.json",
    );

    if (existsSync(changelogPath) && existsSync(changesetConfigPath)) {
      return directory;
    }

    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error(
        `Unable to find the Gruntend repository root from ${startDirectory}.`,
      );
    }
    directory = parent;
  }
}

function gitDate(args: string[]): string | undefined {
  try {
    const value = execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return value || undefined;
  } catch {
    return undefined;
  }
}

function pendingDate(relativePath: string): string | undefined {
  return gitDate([
    "log",
    "--follow",
    "--diff-filter=A",
    "-1",
    "--format=%aI",
    "--",
    relativePath,
  ]);
}

function parsePendingChange(fileName: string): PendingChange | undefined {
  const relativePath = `.changeset/${fileName}`;
  const source = readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) return undefined;

  const packages = match[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^"([^"]+)":\s*(major|minor|patch)\s*$/))
    .filter((entry): entry is RegExpMatchArray => Boolean(entry))
    .map((entry) => ({
      name: entry[1],
      type: entry[2] as "major" | "minor" | "patch",
    }));
  const groups = parseReleaseGroups(match[2]);

  if (packages.length === 0 || groups.length === 0) return undefined;

  return {
    date: pendingDate(relativePath),
    groups,
    id: fileName.replace(/\.md$/, ""),
    packages,
    sourceUrl: `${repositoryUrl}/blob/main/${relativePath}`,
  };
}

function parseChangeReference(value: string): ChangeReference {
  const normalized = value.replace(/\s+/g, " ").trim();
  const commitMatch = normalized.match(/^([0-9a-f]{7,40}):\s+(.+)$/i);

  return commitMatch
    ? { commit: commitMatch[1], text: commitMatch[2] }
    : { text: normalized };
}

function parseReleaseGroups(body: string): ReleasedChange["groups"] {
  const groups: ReleasedChange["groups"] = [];
  let current = { label: "Release notes", changes: [] as ChangeReference[] };
  let bufferedEntry = "";

  const flushEntry = () => {
    if (!bufferedEntry.trim()) return;
    current.changes.push(parseChangeReference(bufferedEntry));
    bufferedEntry = "";
  };

  const flushGroup = () => {
    flushEntry();
    if (current.changes.length > 0) groups.push(current);
  };

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    const groupMatch = line.match(/^###\s+(.+)$/);

    if (groupMatch) {
      flushGroup();
      current = { label: groupMatch[1], changes: [] };
    } else if (line.startsWith("- ")) {
      flushEntry();
      bufferedEntry = line.slice(2);
    } else if (line.length > 0) {
      if (bufferedEntry) {
        bufferedEntry += ` ${line}`;
      } else {
        bufferedEntry = line;
      }
    }
  }

  flushGroup();
  return groups;
}

function releaseDate(
  version: string,
  headingDate?: string,
): string | undefined {
  if (headingDate) {
    const parsed = new Date(headingDate);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }

  return gitDate(["log", "-1", "--format=%aI", `gruntend-sdk@${version}`]);
}

function readReleasedChanges(): ReleasedChange[] {
  const changelogPath = path.join(repositoryRoot, "CHANGELOG.md");
  const source = readFileSync(changelogPath, "utf8");
  const headingPattern = /^##\s+([^\s(]+)(?:\s+\(([^)]+)\))?\s*$/gm;
  const headings = [...source.matchAll(headingPattern)];

  if (headings.length === 0) {
    throw new Error(`No releases found in ${changelogPath}.`);
  }

  return headings.map((heading, index) => {
    const version = heading[1];
    const bodyStart = (heading.index ?? 0) + heading[0].length;
    const bodyEnd = headings[index + 1]?.index ?? source.length;

    return {
      date: releaseDate(version, heading[2]),
      groups: parseReleaseGroups(source.slice(bodyStart, bodyEnd)),
      sourceUrl: `${repositoryUrl}/tree/gruntend-sdk%40${version}`,
      version,
    };
  });
}

export function readPendingChanges(): PendingChange[] {
  const changesetDirectory = path.join(repositoryRoot, ".changeset");
  if (!existsSync(changesetDirectory)) return [];

  return readdirSync(changesetDirectory)
    .filter((fileName) => fileName.endsWith(".md") && fileName !== "README.md")
    .map(parsePendingChange)
    .filter((change): change is PendingChange => Boolean(change))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export const pendingChanges = readPendingChanges();
export const releasedChanges = readReleasedChanges();
export const commitUrl = (commit: string) =>
  `${repositoryUrl}/commit/${commit}`;
