/* Usage: npm run demo -- "scenario text"      |  npm run eval  |  npm run eval:baseline */
import { readFileSync } from "node:fs";
import { warmup } from "./warmup-lib";
import { corpusSize } from "../src/mastra/rag";
import { renderHtml } from "../src/mastra/report-html";
import { renderMarkdown, runRequirements, runSdlc, writeArtifacts } from "../src/mastra/pipeline";

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const scenarios: { id: string; scenario: string }[] =
  fileIdx >= 0
    ? JSON.parse(readFileSync(args[fileIdx + 1], "utf8"))
    : [{ id: "adhoc", scenario: args.join(" ") || "Design a mobile payments module with KYC onboarding and fraud monitoring." }];

if (process.env.NOWARM !== "1" && !(await warmup())) process.exit(1);
const tag = process.env.RAG === "off" ? "norag" : "rag";
console.log(`FAST=${process.env.FAST === "1" ? "on" : "off"} | cache=${process.env.NOCACHE === "1" ? "off" : "on"}`);
console.log(`Corpus chunks: ${corpusSize()} | mode: ${tag} | model: ${process.env.OLLAMA_MODEL ?? "ledgerlens"}`);

for (const s of scenarios) {
  const t0 = Date.now();
  console.log(`\n== ${s.id}`);
  const profile = await runRequirements(s.scenario);
  console.log(`  requirements: ${profile.functional.length} FR, ${profile.nonFunctional.length} NFR (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  const rec = await runSdlc(profile);
  const dir = writeArtifacts(`${s.id}-${tag}`, renderMarkdown(profile, rec), { profile, recommendation: rec }, renderHtml(profile, rec));
  console.log(`  recommended: ${rec.recommended} | total ${((Date.now() - t0) / 1000).toFixed(0)}s | saved in ${dir}`);
}
