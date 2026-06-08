import { NextResponse } from "next/server";

const GEMINI_TTS_MODEL =
  process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

type GeminiAudioPart = {
  inlineData?: {
    data?: string;
  };
  inline_data?: {
    data?: string;
  };
};

type GeminiTtsResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiAudioPart[];
    };
  }>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function pcmToWav(pcm: Buffer) {
  const byteRate = (SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE) / 8;
  const blockAlign = (CHANNELS * BITS_PER_SAMPLE) / 8;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not set on server" },
        { status: 500 }
      );
    }

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text is required and must be a string" },
        { status: 400 }
      );
    }

    const trimmedText = text.trim();

    if (!trimmedText) {
      return NextResponse.json(
        { error: "text cannot be empty" },
        { status: 400 }
      );
    }

    const ttsPrompt = `
Read the following text aloud exactly as written in Twents/Tweants dialect.
Do not translate it. Do not change it to Standard Dutch, English, or any other language or dialect.
Use natural Twents/Tweants pronunciation, a conversational pace, and a clear single speaker voice.

${trimmedText}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: ttsPrompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Kore",
                },
              },
            },
          },
          model: GEMINI_TTS_MODEL,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Gemini TTS request failed" },
        { status: response.status }
      );
    }

    const data = (await response.json()) as GeminiTtsResponse;
    const audioPart = data.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data || part.inline_data?.data
    );
    const base64Audio =
      audioPart?.inlineData?.data || audioPart?.inline_data?.data;

    if (!base64Audio) {
      return NextResponse.json(
        { error: "Gemini TTS did not return audio" },
        { status: 502 }
      );
    }

    const wav = pcmToWav(Buffer.from(base64Audio, "base64"));

    return new NextResponse(wav, {
      headers: {
        "Content-Type": "audio/wav",
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
