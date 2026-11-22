import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { renderMarkdown, runRequirements, runSdlc, writeArtifacts } from "./pipeline";
import { renderHtml } from "./report-html";
import { RequirementsProfile, SdlcRecommendation } from "./schemas";

const requirementsStep = createStep({
  id: "requirements",
  description: "Finance Requirements Agent: evidence-grounded requirements profile",
  inputSchema: z.object({ scenario: z.string() }),
  outputSchema: RequirementsProfile,
  execute: async ({ inputData }) => runRequirements(inputData.scenario),
});

const sdlcStep = createStep({
  id: "sdlc",
  description: "Finance SDLC Recommendation Agent: rank SDLC options and generate workflow",
  inputSchema: RequirementsProfile,
  outputSchema: z.object({ report: z.string(), recommended: z.string(), artifactDir: z.string() }),
  execute: async ({ inputData }) => {
    const rec: SdlcRecommendation = await runSdlc(inputData);
    const report = renderMarkdown(inputData, rec);
    const artifactDir = writeArtifacts(`run-${Date.now()}`, report, { profile: inputData, recommendation: rec }, renderHtml(inputData, rec));
    return { report, recommended: rec.recommended, artifactDir };
  },
});

export const financeWorkflow = createWorkflow({
  id: "finance-requirements-then-sdlc",
  inputSchema: z.object({ scenario: z.string().describe("Financial software scenario, module or functionality") }),
  outputSchema: z.object({ report: z.string(), recommended: z.string(), artifactDir: z.string() }),
})
  .then(requirementsStep)
  .then(sdlcStep)
  .commit();
