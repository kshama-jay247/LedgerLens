import { Agent } from "@mastra/core/agent";
import { model } from "./llm";
import { REQUIREMENTS_INSTRUCTIONS, SDLC_INSTRUCTIONS } from "./prompts";

export const financeRequirementsAgent = new Agent({
  id: "finance-requirements-agent",
  name: "Finance Requirements Agent",
  instructions: REQUIREMENTS_INSTRUCTIONS,
  model,
});

export const financeSdlcAgent = new Agent({
  id: "finance-sdlc-agent",
  name: "Finance SDLC Recommendation Agent",
  instructions: SDLC_INSTRUCTIONS,
  model,
});
