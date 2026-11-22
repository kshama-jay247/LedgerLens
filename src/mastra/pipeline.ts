import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Agent } from "@mastra/core/agent";
import type { z } from "zod";
import { financeRequirementsAgent, financeSdlcAgent } from "./finance-agents";
import {
  FAST, partAPrompt, partBPrompt, partCPrompt, ratingsPrompt,
} from "./prompts";
import { search, type Chunk } from "./rag";
import { PHASE_TEMPLATES, SDLC_PROFILES, WEIGHTS } from "./sdlc-profiles";
import {
  CRITERIA, PartA, PartB, PartC, Ratings, WorkflowPlan,
  type Criterion, type Requirement, type RequirementsProfile, type SdlcRecommendation,
} from "./schemas";

export type Opts = { rag?: boolean };
const ragOn = (o?: Opts) => o?.rag ?? process.env.RAG !== "off";

/* ---------- helpers ---------- */

/** Disk cache so a repeated scenario returns instantly (set NOCACHE=1 to disable). */
async function cached<T>(parts: unknown[], fn: () => Promise<T>): Promise<T> {
  if (process.env.NOCACHE === "1") return fn();
  const key = createHash("sha1").update(JSON.stringify(["v4", process.env.OLLAMA_MODEL, FAST, ...parts])).digest("hex").slice(0, 16);
  const dir = join(process.cwd(), "artifacts", "cache");
  const file = join(dir, `${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as T;
  const out = await fn();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(out));
  return out;
}


/** Close any brackets left open by a truncated reply (e.g. the model hit its token cap mid-list). */
function repairJson(text: string): string {
  // Drop the incomplete tail after the last finished object/array element.
  const cut = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  let t = text.slice(0, cut + 1);
  const stack: string[] = [];
  let inStr = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  t = t.replace(/,\s*$/, "");
  return t + stack.reverse().join("");
}

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("No JSON object in model output");
  const body = cleaned.slice(start);
  const end = body.lastIndexOf("}");
  try {
    return JSON.parse(body.slice(0, end + 1));
  } catch {
    return JSON.parse(repairJson(body)); // truncated or slightly malformed output
  }
}

/** Ask the model for JSON, validate with zod, retry once with the error fed back. */
async function askJson<S extends z.ZodTypeAny>(agent: Agent, prompt: string, schema: S, retries = 1): Promise<z.infer<S>> {
  let p = prompt;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    const res = await agent.generate(p);
    try {
      return schema.parse(extractJson(res.text));
    } catch (e) {
      lastErr = e;
      p = `${prompt}\n\nYour previous reply was invalid (${String(e).slice(0, 200)}). Return ONLY the JSON object.`;
    }
  }
  throw new Error(`Model did not return valid JSON: ${String(lastErr).slice(0, 300)}`);
}

const fmtEvidence = (cs: Chunk[]) => cs.map((c) => `[${c.id}] ${c.text}`).join("\n\n");

const REG_CLAIM = /\b(pci|gdpr|psd2|sox|sarbanes|aml|kyc|basel|ccpa|glba|dora|rbi|sebi|regulat\w*|complian\w*|compl(?:y|ies)|retention|jurisdiction|statutory)\b/i;

const stems = (t: string) => new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3).map((w) => w.slice(0, 6)));
const GENERIC = stems(
  "should must shall ensure ensures system module mobile support supports provide provides allow allows include includes complies comply meets defined according review verify check test tests data users user process processes practices requirements requirement capabilities",
);

/**
 * Code-side grounding: attach the retrieved chunk that covers the requirement's *distinctive* wording
 * (scenario words and generic words are ignored, so vague statements are not marked as evidence).
 */
export function groundIn(statement: string, chunks: Chunk[], scenario: string): string | null {
  const drop = new Set([...stems(scenario), ...GENERIC]);
  const w = [...stems(statement)].filter((x) => !drop.has(x));
  if (w.length < 3) return null;
  let best = { id: "", score: 0, hit: 0 };
  for (const c of chunks) {
    const cw = stems(c.text);
    const hit = w.filter((x) => cw.has(x)).length;
    if (hit / w.length > best.score) best = { id: c.id, score: hit / w.length, hit };
  }
  return best.hit >= 3 && best.score >= 0.5 ? best.id : null;
}

function normalise(reqs: Requirement[], prefix: string, valid: Set<string>, chunks: Chunk[], scenario: string): Requirement[] {
  return reqs.map((r, i) => {
    let evidence = r.evidence.filter((e) => valid.has(e));
    if (!evidence.length) {
      const g = groundIn(r.statement, chunks, scenario);
      if (g) evidence = [g];
    }
    // Status is decided in code, not trusted from the model.
    const status = evidence.length ? "EVIDENCE" : REG_CLAIM.test(r.statement) ? "NEEDS-VALIDATION" : "REASONED";
    const clean = (t: string) => t.replace(/evidence\s*\[[^\]]*\]/gi, "").trim();
    return { ...r, acceptanceCriteria: clean(r.acceptanceCriteria), verification: clean(r.verification), id: `${prefix}-${i + 1}`, evidence, status };
  });
}

/* ---------- Agent 1: requirements ---------- */

export function runRequirements(scenario: string, opts?: Opts): Promise<RequirementsProfile> {
  return cached(["req", scenario, ragOn(opts)], () => runRequirementsUncached(scenario, opts));
}

const CAP_FR = FAST ? 3 : 6;
const CAP_NFR = FAST ? 4 : 6;

const DRIVERS: [RegExp, string][] = [
  [/kyc|aml|onboard|identity/i, "KYC / AML customer due-diligence obligations"],
  [/payment|card|transfer|wallet/i, "Payment security and customer data-protection rules"],
  [/fraud/i, "Fraud monitoring and suspicious-activity reporting obligations"],
  [/loan|lend|credit/i, "Consumer-credit, disclosure and fair-treatment rules"],
  [/report|audit|ledger|reconcil/i, "Financial reporting and audit requirements"],
];

async function runRequirementsUncached(scenario: string, opts?: Opts): Promise<RequirementsProfile> {
  const chunks = ragOn(opts) ? search(scenario, FAST ? 2 : undefined) : [];
  const ev = fmtEvidence(chunks);
  const valid = new Set(chunks.map((c) => c.id));

  const a = await askJson(financeRequirementsAgent, partAPrompt(scenario, ev), PartA);
  const sc = stems(scenario);
  const cs = stems(a.context);
  const dup = [...cs].filter((x) => sc.has(x)).length / Math.max(1, cs.size) > 0.8;
  const context = dup ? "" : a.context; // drop a context sentence that just repeats the scenario
  const ctx = `${context} Stakeholders: ${a.stakeholders.map((s) => s.name).join(", ")}.`;

  let b = await askJson(financeRequirementsAgent, partBPrompt(scenario, ctx, ev), PartB);
  if (b.functional.length < 2) {
    // Small models sometimes return a single item; ask once more for distinct ones.
    const retry = await askJson(
      financeRequirementsAgent,
      `${partBPrompt(scenario, ctx, ev)}\n\nList at least 3 DISTINCT functional requirements (for example onboarding, core processing, monitoring/review).`,
      PartB,
    ).catch(() => b);
    if (retry.functional.length > b.functional.length) b = retry;
  }
  const c = await askJson(financeRequirementsAgent, partCPrompt(scenario, ctx, ev), PartC);

  // If the model gave no regulatory drivers, derive generic, clearly-unverified ones from the scenario.
  const drivers = a.regulatoryDrivers.length
    ? a.regulatoryDrivers
    : DRIVERS.filter(([re]) => re.test(scenario)).map(([, d]) => `${d} (jurisdiction-specific; confirm with compliance)`);

  return {
    scenario,
    context,
    stakeholders: a.stakeholders,
    regulatoryDrivers: drivers,
    functional: normalise(b.functional.slice(0, CAP_FR), "FR", valid, chunks, scenario),
    nonFunctional: normalise(c.nonFunctional.slice(0, CAP_NFR), "NFR", valid, chunks, scenario),
    risks: c.risks.slice(0, 4).map((r) => ({ risk: r.risk, mitigation: r.mitigation })),
    openQuestions: c.openQuestions.slice(0, 4),
    evidenceUsed: chunks.map((x) => ({ id: x.id, source: x.source })),
  };
}

/* ---------- Agent 2: SDLC ---------- */

const summarise = (p: RequirementsProfile) =>
  [
    `Scenario: ${p.scenario}`,
    ...p.functional.slice(0, FAST ? 5 : 12).map((r) => `${r.id} [${r.priority}] ${r.statement}`),
    ...p.nonFunctional.slice(0, FAST ? 5 : 12).map((r) => `${r.id} [${r.priority}] ${r.statement}`),
    ...p.risks.slice(0, 5).map((r) => `RISK: ${r.risk}`),
  ].join("\n");

/** Deterministic, explainable ranking: weighted distance between project ratings and each method's ideal profile. */
export function rankMethods(scores: Record<Criterion, number>) {
  const maxDist = CRITERIA.reduce((s, c) => s + (WEIGHTS[c] ?? 1) * 4, 0);
  return Object.entries(SDLC_PROFILES)
    .map(([method, ideal]) => {
      const dist = CRITERIA.reduce((s, c) => s + (WEIGHTS[c] ?? 1) * Math.abs(scores[c] - ideal[c]), 0);
      return { method, score: Math.round(100 * (1 - dist / maxDist)) };
    })
    .sort((x, y) => y.score - x.score);
}

export function runSdlc(profile: RequirementsProfile): Promise<SdlcRecommendation> {
  return cached(["sdlc", profile], () => runSdlcUncached(profile));
}

/** Keyword signals from the requirement text: a second, model-independent opinion on each criterion. */
export function keywordScores(p: RequirementsProfile): Record<Criterion, number> {
  const text = [p.scenario, ...p.regulatoryDrivers, ...[...p.functional, ...p.nonFunctional].map((r) => `${r.statement} ${r.acceptanceCriteria}`), ...p.risks.map((r) => r.risk)]
    .join(" ")
    .toLowerCase();
  const n = (re: RegExp) => (text.match(re) ?? []).length;
  const has = (re: RegExp) => (re.test(text) ? 1 : 0);
  const clamp = (x: number) => Math.max(1, Math.min(5, x));
  const reg = n(/kyc|aml|complian|regulat|jurisdiction|sanction|statutory|audit/g);
  return {
    requirementStability: clamp(3 - has(/may change|evolv|uncertain|prototype|experiment|pilot/) + has(/fixed|well-defined|mandated/)),
    regulatoryStrictness: clamp(2 + Math.min(3, reg)),
    securityCriticality: clamp(2 + Math.min(2, n(/encrypt|authenticat|fraud|secur|vault|attack|breach|privacy/g)) + has(/payment|transfer|card|loan|ledger|account|fund/)),
    auditability: clamp(2 + Math.min(3, n(/audit|trace|log|reconcil|immutable|evidence/g))),
    integrationComplexity: clamp(2 + Math.min(3, n(/integrat|gateway|core bank|\bapi\b|third.party|external|interface/g))),
    changeFrequency: clamp(3 + has(/rules|models|versioned|configurable|change process|tuning/) - has(/fixed|mandated/)),
    technicalUncertainty: clamp(2 + has(/machine learning|\bai\b|model|real.time|blockchain|novel/) + has(/prototype|experiment|unproven/)),
    testingFormality: clamp(2 + has(/verify|test|reconcil|acceptance|validation/) + has(/audit|complian/) + (reg >= 3 ? 1 : 0)),
    failureConsequence: clamp(3 + has(/payment|transaction|transfer|loan|ledger|fund|money/) + has(/fraud|loss|penalt|breach/)),
  };
}

const fill = (t: string, p: RequirementsProfile) => {
  const all = [...p.functional, ...p.nonFunctional];
  const ids = (rs: Requirement[]) => (rs.length ? rs.map((r) => r.id).join(", ") : "none");
  return t
    .replace("{ALL}", ids(all))
    .replace("{MUST}", ids(all.filter((r) => r.priority === "MUST")))
    .replace("{VAL}", ids(all.filter((r) => r.status === "NEEDS-VALIDATION")));
};

export async function runSdlcUncached(profile: RequirementsProfile): Promise<SdlcRecommendation> {
  const summary = summarise(profile);
  // Model judgement (may be unusable from a tiny model -> neutral 3s) ...
  const { ratings } = await askJson(financeSdlcAgent, ratingsPrompt(summary, CRITERIA), Ratings).catch(() => Ratings.parse({ ratings: {} }));
  // ... blended 50/50 with keyword signals taken from the requirements themselves.
  const kw = keywordScores(profile);
  const scores = Object.fromEntries(CRITERIA.map((c) => [c, Math.round((ratings[c].score + kw[c]) / 2)])) as Record<Criterion, number>;
  const ranking = rankMethods(scores);
  const recommended = ranking[0].method;
  const ideal = SDLC_PROFILES[recommended];

  const fitting = [...CRITERIA]
    .sort((x, y) => ideal[y] * (4 - Math.abs(scores[y] - ideal[y])) - ideal[x] * (4 - Math.abs(scores[x] - ideal[x])))
    .slice(0, 3);
  const all = [...profile.functional, ...profile.nonFunctional];
  const val = all.filter((r) => r.status === "NEEDS-VALIDATION");

  const plan = {
    rationale: `${recommended} ranks first because the project scores high on ${fitting.map((c) => `${c} (${scores[c]}/5)`).join(", ")}, which this method is designed to handle.`,
    phases: PHASE_TEMPLATES[recommended].map((ph) => ({ ...ph, activities: ph.activities.map((a) => fill(a, profile)) })),
    humanApprovalPoints: [
      `Requirements baseline (${all.map((r) => r.id).join(", ") || "none"})`,
      ...(val.length ? [`Compliance interpretation of ${val.map((r) => r.id).join(", ")}`] : []),
      "Security-critical design",
      "SDLC choice (this recommendation)",
      "Production readiness",
    ],
    needsValidation: [...profile.regulatoryDrivers, ...val.map((r) => `${r.id}: ${r.statement}`)],
  };

  return {
    ratings: Object.fromEntries(CRITERIA.map((c) => [c, { score: scores[c], rationale: `model ${ratings[c].score}, keyword signal ${kw[c]}` }])),
    ranking,
    recommended,
    plan,
    disclaimer:
      "Scores are heuristic decision support, not measured probabilities. Requirements baseline, compliance interpretation, security-critical design, SDLC choice and production readiness require human approval.",
  };
}

/* ---------- Output ---------- */

export function renderMarkdown(p: RequirementsProfile, s: SdlcRecommendation): string {
  const reqRows = (rs: Requirement[]) =>
    rs.map((r) => `| ${r.id} | ${r.priority} | ${r.statement} | ${r.acceptanceCriteria} | ${r.verification} | ${r.status}${r.evidence.length ? ` (${r.evidence.join(", ")})` : ""} |`).join("\n");
  const head = "| ID | Priority | Statement | Acceptance criteria | Verification | Status |\n|---|---|---|---|---|---|";
  return `# LedgerLens report

**Scenario:** ${p.scenario}

${p.context}

## Stakeholders
${p.stakeholders.map((x) => `- **${x.name}**: ${x.concern}`).join("\n")}

## Regulatory drivers (verify before relying on them)
${p.regulatoryDrivers.map((x) => `- ${x}`).join("\n") || "- none identified"}

## Functional requirements
${head}
${reqRows(p.functional)}

## Non-functional requirements
${head}
${reqRows(p.nonFunctional)}

## Risks
${p.risks.map((r) => `- ${r.risk} -> ${r.mitigation}`).join("\n")}

## Open questions
${p.openQuestions.map((q) => `- ${q}`).join("\n")}

## SDLC recommendation: ${s.recommended}
${s.ranking.map((r) => `- ${r.method}: ${r.score}/100`).join("\n")}

### Ratings
${Object.entries(s.ratings).map(([k, v]) => `- ${k}: ${v.score}/5${v.rationale ? ` - ${v.rationale}` : ""}`).join("\n")}

### Project workflow
${s.plan.rationale}

${s.plan.phases.map((ph, i) => `${i + 1}. **${ph.name}**: ${ph.activities.join("; ")}. Exit gate: ${ph.exitGate}. Approver: ${ph.approver}`).join("\n")}

### Human approval points
${s.plan.humanApprovalPoints.map((x) => `- ${x}`).join("\n")}

### NEEDS-VALIDATION
${s.plan.needsValidation.map((x) => `- ${x}`).join("\n") || "- none listed"}

> ${s.disclaimer}

## Evidence used
${p.evidenceUsed.map((e) => `- ${e.id}`).join("\n") || "- none (no-retrieval run)"}
`;
}

export function writeArtifacts(name: string, md: string, data: unknown, html?: string): string {
  const dir = join(process.cwd(), "artifacts", "finance-sdlc");
  mkdirSync(dir, { recursive: true });
  const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  writeFileSync(join(dir, `${name}.md`), md);
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(data, null, 2));
  writeFileSync(join(dir, `${name}.html`), html ?? `<!doctype html><meta charset="utf-8"><title>LedgerLens</title><pre style="white-space:pre-wrap;font-family:system-ui;max-width:900px;margin:2rem auto">${esc}</pre>`);
  return dir;
}