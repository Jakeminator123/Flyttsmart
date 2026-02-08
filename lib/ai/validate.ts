import { getOpenAIClient } from "./openai";
import { VALIDATE_PERSON_SYSTEM } from "./prompts";

export interface ValidationInput {
  name?: string;
  address?: string;
  postal?: string;
  city?: string;
  personalNumber?: string;
  email?: string;
  phone?: string;
}

export interface ValidationResult {
  confidence: number;
  valid: boolean;
  suggestions: string[];
  correctedData: Partial<ValidationInput> | null;
}

/**
 * Validate person data using OpenAI.
 * Uses gpt-4o-mini for fast + cheap validation.
 */
export async function validatePersonData(
  input: ValidationInput
): Promise<ValidationResult> {
  const client = getOpenAIClient();

  const userMessage = `Validate this person data:\n${JSON.stringify(input, null, 2)}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: VALIDATE_PERSON_SYSTEM },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      confidence: 0,
      valid: false,
      suggestions: ["AI validation failed – no response"],
      correctedData: null,
    };
  }

  try {
    return JSON.parse(content) as ValidationResult;
  } catch {
    return {
      confidence: 0,
      valid: false,
      suggestions: ["AI validation failed – could not parse response"],
      correctedData: null,
    };
  }
}
