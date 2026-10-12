#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";

const ROOT = process.cwd();
const VAULT = join(ROOT, "docs", "obsidian-vault");
const MANIFEST = join(ROOT, ".ai", "source-manifest.json");
const TRACKED_PATHS = [
  ".agents",
  ".ai",
  "src",
  "prisma",
  "scripts",
  ".github",
  ".claude",
  "skills-lock.json",
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "public",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "components.json",
  ".env.example",
  "README.md",
];
const IGNORED_DIRS = new Set([".git", ".next", "node_modules", "dist", "build", "coverage"]);
const SECRET_NAMES = /(^|\/)(\.env($|\.)|.*\.(pem|key|p12|pfx)$|id_rsa($|\.))/i;
const MERMAID_TYPES = /^(flowchart|graph|sequenceDiagram|erDiagram|stateDiagram(?:-v2)?|classDiagram|journey|gantt|pie|timeline|mindmap|gitGraph)\b/;

function normalizePath(path) {
  return path.split(sep).join("/");
}

function walk(path, predicate = () => true) {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return predicate(path) ? [path] : [];
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...walk(child, predicate));
    else if (entry.isFile() && predicate(child)) files.push(child);
  }
  return files;
}

function trackedFiles() {
  const files = TRACKED_PATHS.flatMap((path) => walk(join(ROOT, path)));
  return [...new Set(files)]
    .filter((path) => normalizePath(relative(ROOT, path)) !== ".ai/source-manifest.json")
    .filter((path) => !SECRET_NAMES.test(normalizePath(relative(ROOT, path))))
    .sort((a, b) => normalizePath(a).localeCompare(normalizePath(b)));
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sourceSnapshot() {
  return Object.fromEntries(
    trackedFiles().map((path) => [normalizePath(relative(ROOT, path)), hashFile(path)]),
  );
}

function baseline() {
  const validation = validateVault(false);
  if (!validation.ok) {
    console.error("Baseline dibatalkan: knowledge validation gagal.");
    process.exitCode = 1;
    return;
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    algorithm: "sha256",
    scope: TRACKED_PATHS,
    files: sourceSnapshot(),
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Baseline ditulis: ${Object.keys(manifest.files).length} source files.`);
}

function check() {
  if (!existsSync(MANIFEST)) {
    console.error("Baseline belum ada. Jalankan: node scripts/knowledge-sync.mjs baseline");
    process.exitCode = 2;
    return;
  }

  const previous = JSON.parse(readFileSync(MANIFEST, "utf8")).files ?? {};
  const current = sourceSnapshot();
  const added = Object.keys(current).filter((path) => !(path in previous));
  const changed = Object.keys(current).filter((path) => path in previous && current[path] !== previous[path]);
  const deleted = Object.keys(previous).filter((path) => !(path in current));

  if (added.length + changed.length + deleted.length === 0) {
    console.log(`Source baseline current: ${Object.keys(current).length} files, no drift.`);
    return;
  }

  console.error("Source drift detected; review documentation impact:");
  for (const path of added) console.error(`  A ${path}`);
  for (const path of changed) console.error(`  M ${path}`);
  for (const path of deleted) console.error(`  D ${path}`);
  process.exitCode = 1;
}

function stripMarkdownExtension(value) {
  return value.replace(/\.md$/i, "");
}

function frontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end < 0) return null;
  return { lines: lines.slice(1, end), end };
}

function sourceReferences(frontmatterLines) {
  const refs = [];
  for (let index = 0; index < frontmatterLines.length; index += 1) {
    const line = frontmatterLines[index];
    const inline = line.match(/^source_files:\s*\[(.*)\]\s*$/);
    if (inline) {
      for (const raw of inline[1].split(",")) {
        const value = raw.trim().replace(/^['"]|['"]$/g, "");
        if (value) refs.push(value);
      }
      continue;
    }
    if (/^source_files:\s*$/.test(line)) {
      for (let child = index + 1; child < frontmatterLines.length; child += 1) {
        const match = frontmatterLines[child].match(/^\s+-\s+(.+?)\s*$/);
        if (!match) break;
        refs.push(match[1].replace(/^['"]|['"]$/g, ""));
        index = child;
      }
    }
  }
  return refs;
}

function validateVault(print = true) {
  const errors = [];
  if (!existsSync(VAULT)) {
    errors.push("Vault tidak ditemukan: docs/obsidian-vault");
  }

  const notes = existsSync(VAULT)
    ? walk(VAULT, (path) => extname(path).toLowerCase() === ".md").sort()
    : [];
  const operationalNotes = [
    ...walk(join(ROOT, ".ai"), (path) => extname(path).toLowerCase() === ".md"),
    ...["AGENTS.md", "CLAUDE.md", "GEMINI.md"]
      .map((path) => join(ROOT, path))
      .filter((path) => existsSync(path)),
  ].sort();
  const knowledgeMarkdown = [...notes, ...operationalNotes];
  const byName = new Map();
  const byPath = new Set();
  for (const path of notes) {
    const name = stripMarkdownExtension(basename(path));
    const relativePath = stripMarkdownExtension(normalizePath(relative(VAULT, path)));
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(relativePath);
    byPath.add(relativePath);
  }

  let wikilinks = 0;
  let diagrams = 0;
  let sourceRefs = 0;
  let markdownLinks = 0;
  for (const path of notes) {
    const rel = normalizePath(relative(ROOT, path));
    const content = readFileSync(path, "utf8");
    const fm = frontmatter(content);
    if (!fm) {
      errors.push(`${rel}: frontmatter YAML tidak lengkap`);
      continue;
    }
    for (const field of ["type", "status", "last_verified"]) {
      if (!fm.lines.some((line) => line.startsWith(`${field}:`))) {
        errors.push(`${rel}: frontmatter kehilangan ${field}`);
      }
    }

    for (const ref of sourceReferences(fm.lines)) {
      sourceRefs += 1;
      const absolute = resolve(ROOT, ref);
      if (!absolute.startsWith(ROOT) || !existsSync(absolute)) {
        errors.push(`${rel}: source reference tidak ditemukan: ${ref}`);
      }
    }

    const linkPattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
    for (const match of content.matchAll(linkPattern)) {
      wikilinks += 1;
      const target = stripMarkdownExtension(match[1].trim().replace(/\\/g, "/"));
      if (target.includes("/")) {
        if (!byPath.has(target)) errors.push(`${rel}: wikilink tidak ditemukan: [[${match[1]}]]`);
      } else {
        const candidates = byName.get(target) ?? [];
        if (candidates.length === 0) errors.push(`${rel}: wikilink tidak ditemukan: [[${target}]]`);
        else if (candidates.length > 1) errors.push(`${rel}: wikilink ambigu: [[${target}]] -> ${candidates.join(", ")}`);
      }
    }

    const openings = (content.match(/```mermaid\s*(?:\r?\n|$)/g) ?? []).length;
    let matched = 0;
    const mermaidPattern = /```mermaid\s*\r?\n([\s\S]*?)```/g;
    for (const match of content.matchAll(mermaidPattern)) {
      matched += 1;
      diagrams += 1;
      const firstLine = match[1].split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
      if (!MERMAID_TYPES.test(firstLine)) {
        errors.push(`${rel}: tipe Mermaid tidak dikenali: ${firstLine || "<empty>"}`);
      }
    }
    if (openings !== matched) errors.push(`${rel}: fence Mermaid tidak tertutup`);
  }

  for (const path of knowledgeMarkdown) {
    const rel = normalizePath(relative(ROOT, path));
    const content = readFileSync(path, "utf8");
    const markdownLinkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
    for (const match of content.matchAll(markdownLinkPattern)) {
      const rawTarget = match[1].trim().replace(/^<|>$/g, "");
      if (/^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
      markdownLinks += 1;
      const fileTarget = rawTarget.split("#", 1)[0];
      let decodedTarget;
      try {
        decodedTarget = decodeURIComponent(fileTarget);
      } catch {
        errors.push(`${rel}: markdown link tidak dapat di-decode: ${rawTarget}`);
        continue;
      }
      const absolute = resolve(dirname(path), decodedTarget);
      if (!absolute.startsWith(ROOT) || !existsSync(absolute)) {
        errors.push(`${rel}: markdown link tidak ditemukan: ${rawTarget}`);
      }
    }
  }

  const result = {
    ok: errors.length === 0,
    notes: notes.length,
    operationalNotes: operationalNotes.length,
    wikilinks,
    markdownLinks,
    diagrams,
    sourceRefs,
    broken: errors.length,
    errors,
  };

  if (print) {
    console.log(
      `Knowledge validation: ${result.notes} vault notes, ${result.operationalNotes} operational notes, ` +
      `${result.wikilinks} wikilinks, ${result.markdownLinks} markdown links, ${result.diagrams} diagrams, ` +
      `${result.sourceRefs} source refs, ${result.broken} errors.`,
    );
    for (const error of errors) console.error(`  - ${error}`);
  }
  if (!result.ok) process.exitCode = 1;
  return result;
}

const command = process.argv[2] ?? "validate";
if (command === "baseline") baseline();
else if (command === "check") check();
else if (command === "validate") validateVault(true);
else {
  console.error("Usage: node scripts/knowledge-sync.mjs <validate|baseline|check>");
  process.exitCode = 2;
}
