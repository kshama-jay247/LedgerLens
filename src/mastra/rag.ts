import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type Chunk = { id: string; source: string; text: string };

const CORPUS_DIR = join(process.cwd(), "docs", "ingested", "finance");
const STOP = new Set("a an the and or of to in on for with is are be as at by it this that from".split(" "));
const tokenize = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t));

function walk(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") && !p.endsWith("README.md") ? [p] : [];
    });
  } catch {
    return [];
  }
}

function chunkText(text: string, maxWords = 130): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    if (cur.length + words.length > maxWords && cur.length) {
      out.push(cur.join(" "));
      cur = [];
    }
    cur.push(...words);
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}

type Index = { chunks: Chunk[]; tf: Map<string, number>[]; len: number[]; df: Map<string, number>; avg: number };
let index: Index | null = null;

function build(): Index {
  const chunks: Chunk[] = [];
  for (const file of walk(CORPUS_DIR)) {
    const source = relative(CORPUS_DIR, file).replace(/\\/g, "/");
    chunkText(readFileSync(file, "utf8")).forEach((t, i) => chunks.push({ id: `${source}#${i}`, source, text: t }));
  }
  const tf = chunks.map((c) => {
    const m = new Map<string, number>();
    tokenize(c.text).forEach((t) => m.set(t, (m.get(t) ?? 0) + 1));
    return m;
  });
  const len = tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
  const df = new Map<string, number>();
  tf.forEach((m) => m.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  return { chunks, tf, len, df, avg: len.reduce((a, b) => a + b, 0) / Math.max(1, len.length) };
}

/** BM25 over the finance corpus. Returns [] if the corpus has not been fetched yet. */
export function search(query: string, k = Number(process.env.RAG_TOP_K ?? 4)): Chunk[] {
  index ??= build();
  const { chunks, tf, len, df, avg } = index;
  const N = chunks.length;
  if (!N) return [];
  const k1 = 1.5, b = 0.75;
  const q = tokenize(query);
  const scored = chunks.map((c, i) => {
    let s = 0;
    for (const t of q) {
      const f = tf[i].get(t);
      if (!f) continue;
      const d = df.get(t) ?? 0;
      const idf = Math.log(1 + (N - d + 0.5) / (d + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * len[i]) / avg)));
    }
    return { c, s };
  });
  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => ({ ...x.c, text: x.c.text.slice(0, process.env.FAST === "1" ? 400 : 700) }));
}

export const corpusSize = () => (index ??= build()).chunks.length;
