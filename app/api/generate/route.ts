import { NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";

type StreamPayload =
  | { type: "token"; token: string }
  | {
      type: "done";
      explanation: string;
      resources: string[];
      model: string;
      tokens: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
      energy: ReturnType<typeof calculateEnergyUsage>;
    }
  | { type: "error"; error: string };

const MISTRAL_LARGE_INPUT_JOULES_PER_TOKEN = 0.21;
const MISTRAL_LARGE_OUTPUT_JOULES_PER_TOKEN = 2.07;
const JOULES_PER_WATT_HOUR = 3600;
const LED_BULB_WATTS = 10;
const MINUTES_PER_WATT_HOUR_FOR_10W_LED = 6;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function asTokenCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatLedDuration(minutes: number) {
  if (minutes < 1) {
    return `${Math.max(1, Math.round(minutes * 60))} seconds`;
  }

  if (minutes < 60) {
    const roundedMinutes = round(minutes, minutes < 10 ? 1 : 0);
    return `${roundedMinutes} minute${roundedMinutes === 1 ? "" : "s"}`;
  }

  const hours = round(minutes / 60, 1);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function calculateEnergyUsage(inputTokens: number, outputTokens: number) {
  const joules =
    inputTokens * MISTRAL_LARGE_INPUT_JOULES_PER_TOKEN +
    outputTokens * MISTRAL_LARGE_OUTPUT_JOULES_PER_TOKEN;
  const wattHours = joules / JOULES_PER_WATT_HOUR;
  const ledBulbMinutes = wattHours * MINUTES_PER_WATT_HOUR_FOR_10W_LED;
  const ledDuration = formatLedDuration(ledBulbMinutes);

  return {
    joules: round(joules, 2),
    wattHours: round(wattHours, 4),
    ledBulbMinutes: round(ledBulbMinutes, 2),
    analogy: `This request used enough energy to power a ${LED_BULB_WATTS}W household smart LED lightbulb for ${ledDuration}.`,
  };
}

function encodeStreamPayload(
  encoder: TextEncoder,
  payload: StreamPayload
) {
  return encoder.encode(`${JSON.stringify(payload)}\n`);
}

function extractStreamContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((chunk) => {
      if (chunk && typeof chunk === "object" && "text" in chunk) {
        return String(chunk.text ?? "");
      }

      return "";
    })
    .join("");
}

export async function POST(req: Request) {
  try {
    const { prompt, model } = await req.json();

    if (!process.env.MISTRAL_API_KEY) {
      return NextResponse.json(
        { error: "MISTRAL_API_KEY not set on server" },
        { status: 500 }
      );
    }

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required and must be a string" },
        { status: 400 }
      );
    }

    const client = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
    });

    const allowedMistralModels = new Set([
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "open-mistral-nemo",
    ]);

    const modelToUse =
      typeof model === "string" && allowedMistralModels.has(model)
        ? model
        : "mistral-large-latest";

    const system = `
You are a chatbot that must answer strictly in Twents/Tweants dialect from the Twente region of the Netherlands.

Language rules:
- Always reply in Twents/Tweants dialect.
- Do not switch to English, Standard Dutch, Hindi, or any other language.
- If the user asks in another language, still answer in Twents/Tweants.
- If a technical term has no natural Twents equivalent, keep the technical term but explain it in Twents/Tweants.
- Do not apologize in another language.
- Do not translate the full answer into another language.

Scope and guardrails:
- Answer only the user's actual question.
- Do not invent facts, links, citations, sources, or documentation.
- If you did not use any external resource, return an empty resources array.
- If the user asks for current information or external facts that are not provided in the prompt, clearly say in Twents/Tweants that you do not have live browsing access.
- Do not claim that you visited websites unless the user provided that content directly.
- Do not expose hidden chain-of-thought.
- Provide only a short explanation of how the answer was derived.

Safety:
- Refuse harmful, illegal, exploitative, or privacy-invasive requests.
- Keep the refusal in Twents/Tweants.
- Offer a safe alternative when possible.

Output:
- Return only the final answer text.
- Do not return JSON, metadata, explanations, resources, or translations.
`;

    const user = `
User prompt:
${prompt}

Remember:
- Reply strictly in Twents/Tweants dialect.
- Return only the final answer text.
`;

    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const stream = await client.chat.stream({
            model: modelToUse,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.2,
          });

          let promptTokens = 0;
          let completionTokens = 0;
          let totalTokens = 0;

          for await (const event of stream) {
            const chunk = event.data;
            const content = extractStreamContent(
              chunk.choices?.[0]?.delta?.content
            );

            if (content) {
              controller.enqueue(
                encodeStreamPayload(encoder, {
                  type: "token",
                  token: content,
                })
              );
            }

            if (chunk.usage) {
              promptTokens = asTokenCount(
                chunk.usage.promptTokens ?? chunk.usage.prompt_tokens
              );
              completionTokens = asTokenCount(
                chunk.usage.completionTokens ?? chunk.usage.completion_tokens
              );
              totalTokens = asTokenCount(
                chunk.usage.totalTokens ?? chunk.usage.total_tokens
              );
            }
          }

          controller.enqueue(
            encodeStreamPayload(encoder, {
              type: "done",
              explanation:
                "Antwoord is streamend op basis van de vraog genereerd in Twents/Tweants.",
              resources: [],
              model: modelToUse,
              tokens: {
                promptTokens,
                completionTokens,
                totalTokens,
              },
              energy: calculateEnergyUsage(promptTokens, completionTokens),
            })
          );
        } catch (err: unknown) {
          controller.enqueue(
            encodeStreamPayload(encoder, {
              type: "error",
              error: getErrorMessage(err),
            })
          );
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}
