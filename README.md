# LedgerLens: Software Architecture Intelligence for Finance

A local-first, multi-agent assistant for **financial-sector software requirements and SDLC recommendation**, modelled on the SAI education project. It runs entirely on a local LLM through **Ollama**.

Two agents run in sequence:

1. **Finance Requirements Agent** builds an evidence-grounded requirements profile (stakeholders, regulatory drivers, functional and non-functional requirements with acceptance criteria and verification, risks, open questions).
2. **Finance SDLC Recommendation Agent** rates the project on nine criteria, ranks Waterfall, V-Model, Spiral, Agile, DevSecOps and a named hybrid, and generates a project-specific workflow with approval gates.

The pipeline is exposed as the Mastra workflow `finance-requirements-then-sdlc` and writes Markdown, HTML and JSON to `artifacts/finance-sdlc/`.

## Design decisions

- **Retrieval-grounded:** BM25 over `docs/ingested/finance/`. Requirement status (`EVIDENCE` / `REASONED` / `NEEDS-VALIDATION`) is assigned **in code**: a requirement is `EVIDENCE` only if it cites a retrieved chunk, and regulatory-sounding claims without evidence are `NEEDS-VALIDATION`.
- **Heuristic, explainable ranking:** the LLM only rates criteria (1-5, citing requirement IDs). Ranking is a deterministic weighted distance to each method's ideal profile (`src/mastra/sdlc-profiles.ts`). Scores are decision support, not probabilities.
- **Small-model friendly:** each agent works in several short JSON calls, validated with Zod and retried once.
- **Human in the loop:** requirements baseline, compliance interpretation, security-critical design, SDLC choice and production readiness require human approval.

## Quick start

Prerequisites: Node.js >= 22.13 and [Ollama](https://ollama.com).

```bash
git clone <your-repo-url> && cd ledgerlens
npm install
cp .env.example .env

ollama pull qwen2.5:3b-instruct
ollama create ledgerlens -f Modelfile      # 4k context, low temperature

npm run corpus                          # download public finance project docs
npm run demo -- "Design a mobile payments module with KYC and fraud monitoring"
npm run dev                             # Mastra Studio: run finance-requirements-then-sdlc
npm run check                           # type-check
```

Slow? See [docs/OLLAMA_PERFORMANCE.md](docs/OLLAMA_PERFORMANCE.md).

## Fast mode (live demos / CPU-only laptops)

```bash
ollama pull qwen2.5:1.5b-instruct
ollama create ledgerlens-fast -f Modelfile.fast
npm run demo:fast -- "Design a mobile payments module with KYC"
```

`demo:fast` sets everything itself (small model, terse output, 2 evidence chunks) and **warms the model into RAM automatically** before running. Use `npm run warmup:fast` to pre-load it before a demo starts. Results are cached under `artifacts/cache/`, so a scenario you already ran returns instantly (`NOCACHE=1` to disable; `NOWARM=1` skips warm-up). Works on Windows, macOS and Linux.

## Evaluation

```bash
npm run eval            # 4 scenarios, with retrieval (npm run eval:fast for quick mode)
npm run eval:baseline   # same scenarios, no retrieval (RAG=off)
```

Compare the outputs in `artifacts/finance-sdlc/` (`*-rag.*` vs `*-norag.*`) on requirement completeness against your own checklist, citation grounding rate, and SDLC plausibility. Edit `eval/scenarios.json` to add scenarios.

## Structure

```
docs/ingested/finance/     corpus (fetched + manual regulatory notes)
eval/scenarios.json        evaluation scenarios
scripts/                   run-demo.ts, fetch-corpus.ts
src/mastra/
  llm.ts                   Ollama provider (OpenAI-compatible)
  prompts.ts  schemas.ts   prompts and Zod schemas
  rag.ts                   BM25 retrieval
  finance-agents.ts        the two agents
  pipeline.ts              requirements -> ratings -> ranking -> plan -> report
  sdlc-profiles.ts         heuristic SDLC profiles and weights
  finance-workflow.ts      Mastra workflow
  index.ts                 Mastra instance
```

## Limitations

- Outputs from small local models need human review. This is decision support, not compliance or legal advice.
- The corpus reports documented public practices only; it does not claim undocumented practices don't exist.
- Never treat a `NEEDS-VALIDATION` item as a confirmed obligation.

## License

MIT
