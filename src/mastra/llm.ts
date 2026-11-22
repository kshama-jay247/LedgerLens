import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
  apiKey: "ollama", // Ollama ignores the key but the client requires one
});

export const model = ollama(process.env.OLLAMA_MODEL ?? "ledgerlens");
