/** FAST=1 trades detail for speed: fewer items, terse fields (for CPU-only machines / live demos). */
export const FAST = process.env.FAST === "1";
const N = FAST ? 3 : 6;
const W = FAST ? 12 : 30;
const TERSE = `Keep every list to at most ${N} items and every text field under ${W} words.`;

export const REQUIREMENTS_INSTRUCTIONS = `You are the Finance Requirements Agent for financial-sector software.
Rules:
- Reply with ONE JSON object only. No prose, no markdown fences.
- Ground requirements in the numbered EVIDENCE snippets when possible; cite their ids in "evidence".
- Write requirements for THE USER'S SCENARIO in your own words. Evidence is background only: never copy an evidence passage as a requirement, and ignore evidence that is not about the scenario.
- Put chunk ids only in the "evidence" field, copied exactly as shown in square brackets (e.g. "payments.md#0"). Leave it empty if unsure.
- Stakeholders are real roles (e.g. Customers, Compliance Officer, Fraud Analyst, Operations, Auditors, Engineering), not generic words.
- Do not invent regulatory, jurisdiction, retention, AML/KYC, or audit claims. If a claim is not in the evidence, leave "evidence" empty.
- Each requirement must be atomic, testable, and have acceptanceCriteria and a verification method.
- ${TERSE}`;

export const SDLC_INSTRUCTIONS = `You are the Finance SDLC Recommendation Agent.
Rules:
- Reply with ONE JSON object only. No prose, no markdown fences.
- Scores are heuristic decision support, not probabilities.
- Never claim a regulatory obligation that is not supported by the supplied requirements; list such items under "needsValidation".
- Final baselines, compliance interpretation, security-critical design, SDLC choice and production readiness need human approval.`;

export const partAPrompt = (scenario: string, evidence: string) => `SCENARIO: ${scenario}

EVIDENCE:
${evidence || "(none retrieved)"}

Return JSON: {"context": one sentence on what the system does and for whom (do not just repeat the scenario), "stakeholders": [{"name": string, "concern": string}], "regulatoryDrivers": [string]}`;

export const partBPrompt = (scenario: string, ctx: string, evidence: string) => `SCENARIO: ${scenario}
CONTEXT: ${ctx}

EVIDENCE:
${evidence || "(none retrieved)"}

List FUNCTIONAL requirements. Return JSON:
{"functional": [{"id": "FR-1", "statement": string, "priority": "MUST"|"SHOULD"|"COULD", "acceptanceCriteria": string, "verification": string, "evidence": [evidenceIds], "status": "EVIDENCE"|"REASONED"|"NEEDS-VALIDATION"}]}`;

export const partCPrompt = (scenario: string, ctx: string, evidence: string) => `SCENARIO: ${scenario}
CONTEXT: ${ctx}

EVIDENCE:
${evidence || "(none retrieved)"}

List NON-FUNCTIONAL requirements (security, auditability, availability, performance, data integrity, privacy, compliance), plus risks and open questions. Return JSON with the keys in THIS order (risks and openQuestions first, at most 3 each; at most 4 non-functional requirements):
{"risks": [{"risk": string, "mitigation": string}], "openQuestions": [string],
 "nonFunctional": [{"id": "NFR-1", "statement": string, "priority": "MUST"|"SHOULD"|"COULD", "acceptanceCriteria": string, "verification": string, "evidence": [evidenceIds], "status": "EVIDENCE"|"REASONED"|"NEEDS-VALIDATION"}]}`;

export const ratingsPrompt = (summary: string, criteria: readonly string[]) => `Rate this financial software project from 1 (low) to 5 (high) on each criterion.

Scale anchors: requirementStability 5 = fixed, well-understood requirements; regulatoryStrictness 5 = heavily regulated (banking, payments, lending, KYC/AML); securityCriticality 5 = handles money or sensitive personal data; auditability 5 = decisions must be traceable for auditors; integrationComplexity 5 = many external systems; changeFrequency 5 = requirements change often; technicalUncertainty 5 = unproven technology; testingFormality 5 = formal verification and sign-off needed; failureConsequence 5 = failure causes financial loss or regulatory penalty.

PROJECT REQUIREMENTS:
${summary}

Return JSON: {"ratings": {${criteria.map((c) => `"${c}": <number 1-5>`).join(", ")}}} (numbers only, no explanations)`;

export const planPrompt = (method: string, summary: string) => `Chosen SDLC: ${method}

PROJECT REQUIREMENTS:
${summary}

Create a project-specific workflow with ${FAST ? "4" : "4-6"} phases. ${TERSE} Return JSON:
{"rationale": string, "phases": [{"name": string, "activities": [string], "exitGate": string, "approver": string}], "humanApprovalPoints": [string], "needsValidation": [string]}`;