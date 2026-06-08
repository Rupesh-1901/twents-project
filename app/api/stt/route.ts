import { NextResponse } from "next/server";

type DeepgramWord = {
  word?: string;
};

type DeepgramAlternative = {
  transcript?: string;
  words?: DeepgramWord[];
};

type DeepgramResponse = {
  results?: {
    channels?: Array<{
      alternatives?: DeepgramAlternative[];
    }>;
  };
};

const DEEPGRAM_STT_MODEL = "nova-3";
const TWENTS_LANGUAGE_HINT = "nl";
const TWENTS_KEYTERMS = [
  "Twents",
  "Tweants",
  "Twente",
  "iej",
  "doe",
  "wiej",
  "ow",
  "oet",
  "goodgoan",
  "goodgaon",
  "mangs",
  "niej",
  "neet",
  "könt",
  "kiek",
  "leu",
  "noar",
  "veur",
  "d'r",
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function extractExactTranscript(alternative: DeepgramAlternative | undefined) {
  const words = alternative?.words
    ?.map((word) => word.word)
    .filter((word): word is string => Boolean(word));

  if (words?.length) {
    return words.join(" ");
  }

  return alternative?.transcript?.trim() || "";
}

export async function POST(req: Request) {
  try {
    if (!process.env.DEEPGRAM_API_KEY) {
      return NextResponse.json(
        { error: "DEEPGRAM_API_KEY not set on server" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "audio file is required" },
        { status: 400 }
      );
    }

    const audioBuffer = await audio.arrayBuffer();
    const audioType = audio.type || "audio/webm";
    const url = new URL("https://api.deepgram.com/v1/listen");

    url.searchParams.set("model", DEEPGRAM_STT_MODEL);
    url.searchParams.set("language", TWENTS_LANGUAGE_HINT);
    url.searchParams.set("smart_format", "false");
    url.searchParams.set("punctuate", "false");
    url.searchParams.set("numerals", "false");
    url.searchParams.set("filler_words", "true");
    TWENTS_KEYTERMS.forEach((keyterm) =>
      url.searchParams.append("keyterm", keyterm)
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": audioType,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Deepgram transcription failed" },
        { status: response.status }
      );
    }

    const data = (await response.json()) as DeepgramResponse;
    const alternative = data.results?.channels?.[0]?.alternatives?.[0];
    const transcript = extractExactTranscript(alternative);

    return NextResponse.json({
      transcript,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}
