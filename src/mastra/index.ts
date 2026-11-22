import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { financeRequirementsAgent, financeSdlcAgent } from "./finance-agents";
import { financeWorkflow } from "./finance-workflow";

export const mastra = new Mastra({
  agents: { financeRequirementsAgent, financeSdlcAgent },
  workflows: { financeWorkflow },
  storage: new LibSQLStore({ id: "ledgerlens-storage", url: process.env.MASTRA_DATABASE_URL ?? "file:./ledgerlens.db" }),
});
