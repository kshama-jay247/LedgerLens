import type { Criterion } from "./schemas";

/**
 * Heuristic "ideal project profile" (1-5 per criterion) for each SDLC option.
 * Scores are decision support, NOT measured probabilities. Edit these to tune
 * the recommender - and justify any change in your report.
 */
export const SDLC_PROFILES: Record<string, Record<Criterion, number>> = {
  Waterfall: {
    requirementStability: 5, regulatoryStrictness: 4, securityCriticality: 3, auditability: 4,
    integrationComplexity: 2, changeFrequency: 1, technicalUncertainty: 1, testingFormality: 4, failureConsequence: 3,
  },
  "V-Model": {
    requirementStability: 4, regulatoryStrictness: 5, securityCriticality: 4, auditability: 5,
    integrationComplexity: 3, changeFrequency: 2, technicalUncertainty: 2, testingFormality: 5, failureConsequence: 5,
  },
  Spiral: {
    requirementStability: 2, regulatoryStrictness: 3, securityCriticality: 4, auditability: 3,
    integrationComplexity: 4, changeFrequency: 3, technicalUncertainty: 5, testingFormality: 3, failureConsequence: 4,
  },
  Agile: {
    requirementStability: 1, regulatoryStrictness: 2, securityCriticality: 2, auditability: 2,
    integrationComplexity: 3, changeFrequency: 5, technicalUncertainty: 3, testingFormality: 2, failureConsequence: 2,
  },
  DevSecOps: {
    requirementStability: 3, regulatoryStrictness: 4, securityCriticality: 5, auditability: 4,
    integrationComplexity: 4, changeFrequency: 4, technicalUncertainty: 3, testingFormality: 4, failureConsequence: 4,
  },
  "Hybrid (V-Model gates + Agile iterations)": {
    requirementStability: 3, regulatoryStrictness: 5, securityCriticality: 4, auditability: 5,
    integrationComplexity: 4, changeFrequency: 3, technicalUncertainty: 3, testingFormality: 4, failureConsequence: 4,
  },
};

/** Optional per-criterion weights (default 1). Raise a weight to make it matter more. */
export const WEIGHTS: Partial<Record<Criterion, number>> = {
  regulatoryStrictness: 1.5,
  failureConsequence: 1.5,
};

/**
 * Phase templates per method. Placeholders are filled in code from the actual requirements:
 * {MUST} = ids of MUST requirements, {VAL} = ids still NEEDS-VALIDATION, {ALL} = every requirement id.
 */
export type PhaseTemplate = { name: string; activities: string[]; exitGate: string; approver: string };

const vmodel: PhaseTemplate[] = [
  { name: "Requirements and compliance analysis", activities: ["Baseline requirements {ALL}", "Resolve {VAL} with the compliance team", "Define a test per requirement up front"], exitGate: "Requirements baseline signed off", approver: "Product Owner + Compliance Officer" },
  { name: "Architecture and security design", activities: ["Architecture and integration design", "Threat model and security-critical design", "Plan verification for {MUST}"], exitGate: "Design and security review passed", approver: "Architect + Security Lead" },
  { name: "Implementation", activities: ["Build features", "Peer code review and static analysis"], exitGate: "Code complete and reviewed", approver: "Engineering Lead" },
  { name: "Verification (unit, integration, system)", activities: ["Run the tests mapped to {MUST}", "Reconciliation and audit-log checks", "Performance and resilience testing"], exitGate: "All MUST requirements verified", approver: "QA Lead" },
  { name: "Acceptance and compliance review", activities: ["User acceptance testing", "Penetration test and audit evidence pack"], exitGate: "Compliance and risk sign-off", approver: "Compliance Officer + Risk Manager" },
  { name: "Release and monitoring", activities: ["Staged rollout with rollback plan", "Production fraud/error monitoring"], exitGate: "Production readiness approved", approver: "Release Manager + Business Owner" },
];

export const PHASE_TEMPLATES: Record<string, PhaseTemplate[]> = {
  "V-Model": vmodel,
  Waterfall: [
    { name: "Requirements", activities: ["Freeze requirements {ALL}", "Resolve {VAL}"], exitGate: "Requirements approved", approver: "Product Owner" },
    { name: "Design", activities: ["System and security design"], exitGate: "Design approved", approver: "Architect" },
    { name: "Implementation", activities: ["Build and code review"], exitGate: "Code complete", approver: "Engineering Lead" },
    { name: "Testing", activities: ["Test {MUST}", "Security testing"], exitGate: "Test report accepted", approver: "QA Lead" },
    { name: "Deployment and maintenance", activities: ["Release", "Monitor and maintain"], exitGate: "Production readiness approved", approver: "Release Manager" },
  ],
  Spiral: [
    { name: "Set objectives for this cycle", activities: ["Pick the highest-risk items from {ALL}", "Define success criteria"], exitGate: "Cycle objectives agreed", approver: "Product Owner" },
    { name: "Risk analysis and prototyping", activities: ["Prototype the riskiest integrations and fraud/KYC flows", "Resolve {VAL}"], exitGate: "Top risks reduced or accepted", approver: "Risk Manager + Architect" },
    { name: "Develop and test the increment", activities: ["Build the increment", "Test related requirements"], exitGate: "Increment verified", approver: "QA Lead" },
    { name: "Review and plan next cycle", activities: ["Stakeholder and compliance review", "Update risks and plan"], exitGate: "Go / no-go for next cycle", approver: "Steering group + Compliance Officer" },
  ],
  Agile: [
    { name: "Backlog and sprint planning", activities: ["Turn {ALL} into a prioritised backlog", "Mark {VAL} as blocked until validated"], exitGate: "Sprint goal agreed", approver: "Product Owner" },
    { name: "Sprints", activities: ["Build and test each sprint increment", "Continuous integration"], exitGate: "Definition of done met", approver: "Scrum team" },
    { name: "Review and retrospective", activities: ["Demo to stakeholders", "Adjust backlog"], exitGate: "Increment accepted", approver: "Product Owner" },
    { name: "Release", activities: ["Release increment", "Monitor"], exitGate: "Release approved", approver: "Release Manager" },
  ],
  DevSecOps: [
    { name: "Plan and threat model", activities: ["Prioritise {ALL}", "Threat model; resolve {VAL}"], exitGate: "Security requirements agreed", approver: "Security Lead + Product Owner" },
    { name: "Code with security checks", activities: ["Static analysis and secret scanning", "Peer review"], exitGate: "No critical findings", approver: "Engineering Lead" },
    { name: "Automated build, test and scan", activities: ["CI tests for {MUST}", "Dependency and container scanning"], exitGate: "Pipeline gates green", approver: "QA Lead" },
    { name: "Release with approvals", activities: ["Change approval and audit trail", "Progressive rollout"], exitGate: "Release approved", approver: "Release Manager + Compliance Officer" },
    { name: "Operate and monitor", activities: ["Fraud/error monitoring", "Incident response and feedback to backlog"], exitGate: "Service reviews passed", approver: "Operations Lead" },
  ],
  "Hybrid (V-Model gates + Agile iterations)": [
    { name: "Governance gate: baseline and compliance", activities: ["Baseline requirements {ALL}", "Resolve {VAL} with compliance", "Define verification for {MUST}"], exitGate: "Baseline and security design approved", approver: "Product Owner + Compliance Officer + Architect" },
    { name: "Iterative build (sprints)", activities: ["Short iterations delivering the baselined requirements", "Security and compliance checks in every sprint"], exitGate: "Each sprint meets definition of done", approver: "Scrum team + Security Lead" },
    { name: "Formal verification gate", activities: ["Integration and system tests for {MUST}", "Reconciliation and audit-log checks"], exitGate: "All MUST requirements verified", approver: "QA Lead" },
    { name: "Compliance and risk sign-off", activities: ["User acceptance", "Penetration test and audit evidence pack"], exitGate: "Compliance and risk sign-off", approver: "Compliance Officer + Risk Manager" },
    { name: "Release and monitoring", activities: ["Staged rollout with rollback plan", "Production monitoring"], exitGate: "Production readiness approved", approver: "Release Manager + Business Owner" },
  ],
};