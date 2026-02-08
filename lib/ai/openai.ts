import OpenAI from "openai";

let _client: OpenAI | null = null;

/**
 * Singleton OpenAI client – only created once per process.
 * Uses OPENAI_API_KEY from environment.
 */
export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "sk-your-openai-api-key-here") {
      throw new Error(
        "OPENAI_API_KEY is not configured. Add your key to .env.local"
      );
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
}
