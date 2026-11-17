import OpenAI from "openai";

/**
 * Groq client for the AI sommelier.
 *
 * Groq exposes an OpenAI-compatible API, so the OpenAI SDK works with a
 * different base URL and key. Label scanning (vision) still uses OpenAI.
 */

/** Default sommelier model. Override with GROQ_MODEL in .env.local. */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

export const groqModel = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

/** gpt-oss models reason before answering and accept reasoning parameters */
export const isReasoningModel = (model: string) => model.startsWith("openai/gpt-oss");

let client: OpenAI | null = null;

/**
 * Lazily create the client so a missing key only breaks the sommelier,
 * not every route that imports this module.
 */
export function getGroq(): OpenAI {
  if (!process.env.GROQ_API_KEY) {
    throw new GroqNotConfiguredError();
  }
  client ??= new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
  return client;
}

export class GroqNotConfiguredError extends Error {
  constructor() {
    super("GROQ_API_KEY is not set");
    this.name = "GroqNotConfiguredError";
  }
}
