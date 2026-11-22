import { z } from "zod";

export const REQ_STATUS = ["EVIDENCE", "REASONED", "NEEDS-VALIDATION"] as const;

/** Small local models often omit fields or vary casing, so every field is forgiving. */
export const Requirement = z.object({
  id: z.string().default(""),
  statement: z.string(),
  priority: z.enum(["MUST", "SHOULD", "COULD"]).catch("SHOULD"),
  acceptanceCriteria: z.string().default(""),
  verification: z.string().default(""),
  evidence: z.array(z.string()).default([]),
  status: z.enum(REQ_STATUS).catch("REASONED"),
});
export type Requirement = z.infer<typeof Requirement>;

export const Stakeholder = z.object({ name: z.string(), concern: z.string().default("") });

export const PartA = z.object({
  context: z.string().default(""),
  stakeholders: z.array(Stakeholder).default([]),
  regulatoryDrivers: z.array(z.string()).default([]),
});
export const PartB = z.object({ functional: z.array(Requirement).default([]) });
export const PartC = z.object({
  nonFunctional: z.array(Requirement).default([]),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string().default("") })).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export const RequirementsProfile = z.object({
  scenario: z.string(),
  context: z.string(),
  stakeholders: z.array(Stakeholder),
  regulatoryDrivers: z.array(z.string()),
  functional: z.array(Requirement),
  nonFunctional: z.array(Requirement),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })),
  openQuestions: z.array(z.string()),
  evidenceUsed: z.array(z.object({ id: z.string(), source: z.string() })),
});
export type RequirementsProfile = z.infer<typeof RequirementsProfile>;

export const CRITERIA = [
  "requirementStability",
  "regulatoryStrictness",
  "securityCriticality",
  "auditability",
  "integrationComplexity",
  "changeFrequency",
  "technicalUncertainty",
  "testingFormality",
  "failureConsequence",
] as const;
export type Criterion = (typeof CRITERIA)[number];

// Small models often reply {"criterion": 4} instead of {"criterion": {"score": 4, ...}}; accept both.
const Rating = z.preprocess(
  (v) => (typeof v === "number" || typeof v === "string" ? { score: v } : v),
  z.object({
    score: z.coerce.number().min(1).max(5).catch(3),
    rationale: z.string().default(""),
  }),
);
const defaultRating = { score: 3, rationale: "" };
export const Ratings = z.object({
  ratings: z.object({
    requirementStability: Rating.default(defaultRating),
    regulatoryStrictness: Rating.default(defaultRating),
    securityCriticality: Rating.default(defaultRating),
    auditability: Rating.default(defaultRating),
    integrationComplexity: Rating.default(defaultRating),
    changeFrequency: Rating.default(defaultRating),
    technicalUncertainty: Rating.default(defaultRating),
    testingFormality: Rating.default(defaultRating),
    failureConsequence: Rating.default(defaultRating),
  }).default({}),
});

export const WorkflowPlan = z.object({
  rationale: z.string().default(""),
  phases: z
    .array(
      z.object({
        name: z.string(),
        activities: z.array(z.string()).default([]),
        exitGate: z.string().default(""),
        approver: z.string().default(""),
      }),
    )
    .default([]),
  humanApprovalPoints: z.array(z.string()).default([]),
  needsValidation: z.array(z.string()).default([]),
});

export const SdlcRecommendation = z.object({
  ratings: z.record(z.string(), z.object({ score: z.number(), rationale: z.string() })),
  ranking: z.array(z.object({ method: z.string(), score: z.number() })),
  recommended: z.string(),
  plan: WorkflowPlan,
  disclaimer: z.string(),
});
export type SdlcRecommendation = z.infer<typeof SdlcRecommendation>;
