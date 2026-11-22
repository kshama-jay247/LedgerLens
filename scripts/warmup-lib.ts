/** Loads the Ollama model into RAM and keeps it there, so the first real call isn't slow. */
export async function warmup(): Promise<boolean> {
  const base = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(/\/v1$/, "");
  const model = process.env.OLLAMA_MODEL ?? "ledgerlens";
  const t0 = Date.now();
  try {
    const r = await fetch(`${base}/api/generate`, {
      method: "POST",
      body: JSON.stringify({ model, prompt: "ok", stream: false, keep_alive: "60m", options: { num_predict: 1 } }),
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    console.log(`Model "${model}" ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return true;
  } catch (e) {
    console.error(`Could not warm up "${model}": ${(e as Error).message}\nIs Ollama running, and did you run \`ollama create ${model} -f Modelfile\`?`);
    return false;
  }
}
