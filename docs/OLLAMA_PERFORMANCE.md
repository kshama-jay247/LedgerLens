# Making LedgerLens fast on a small machine

Diagnose first:
1. Windows Task Manager: if **Memory is ~90%+**, the model is swapping to disk. Close other apps and use a smaller model.
2. `ollama ps` while generating: the PROCESSOR column should be mostly `100% GPU`. A CPU/GPU split means the model doesn't fit.

Fixes, in order of impact:
- Use a 3-4B model (`qwen2.5:3b-instruct`, `qwen3:4b`, `llama3.2:3b`, `gemma3:4b`) at Q4 quantization.
- Avoid "thinking" models, or disable thinking; they generate many hidden tokens.
- Keep `num_ctx` at 4096 (see `Modelfile`). Lower `RAG_TOP_K` to 3.
- Start Ollama with `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`, `OLLAMA_KEEP_ALIVE=30m`.
- The pipeline already splits each agent's job into small JSON calls; don't merge them back.
- Run `npm run demo` (CLI) rather than the Studio UI while testing: less overhead.
