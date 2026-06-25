// ChatExample.tsx - Main Component with Think Tag Demo
"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChatHeader } from "./header";
import { MessageList } from "./message-list";
import { ChatFooter } from "./footer";

interface MessageData {
  id: string;
  content: string;
  sender: "user" | "assistant";
  metadata?: Record<string, unknown>;
}

type GenerateStreamEvent =
  | { type: "token"; token?: string }
  | {
      type: "done";
      explanation?: string;
      resources?: string[];
      tokens?: Record<string, unknown>;
      energy?: Record<string, unknown>;
      model?: string;
    }
  | { type: "error"; error?: string };

type GenerationStage = "idle" | "thinking" | "searching" | "responding";

let messageIdSequence = 0;
const JOULES_PER_WATT_HOUR = 3600;
const LED_BULB_WATTS = 10;
const MINUTES_PER_WATT_HOUR_FOR_10W_LED = 6;

function createMessageId(prefix: "user" | "assistant") {
  messageIdSequence += 1;
  return `${prefix}-${Date.now()}-${messageIdSequence}`;
}

function escapePdfText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number) {
  const lines: string[] = [];

  text.split(/\r?\n/).forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";

    if (words.length === 0) {
      lines.push("");
      return;
    }

    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxChars) {
        line = next;
        return;
      }

      if (line) lines.push(line);

      if (word.length <= maxChars) {
        line = word;
        return;
      }

      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      line = "";
    });

    if (line) lines.push(line);
  });

  return lines;
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function asFiniteNumber(value: unknown) {
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

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getMessageResponseEnergyJoules(message: MessageData) {
  if (message.sender !== "assistant") return 0;

  const metadata = message.metadata ?? {};
  const responseEnergy = asRecord(metadata.responseEnergy);
  const energy = asRecord(metadata.energy);

  return asFiniteNumber(responseEnergy?.joules ?? energy?.joules);
}

function calculateConversationEnergy(
  messages: MessageData[],
  currentResponseEnergy: Record<string, unknown>
) {
  const previousJoules = messages.reduce(
    (total, message) => total + getMessageResponseEnergyJoules(message),
    0
  );
  const joules = previousJoules + asFiniteNumber(currentResponseEnergy.joules);
  const wattHours = joules / JOULES_PER_WATT_HOUR;
  const ledBulbMinutes = wattHours * MINUTES_PER_WATT_HOUR_FOR_10W_LED;
  const ledDuration = formatLedDuration(ledBulbMinutes);

  return {
    joules: round(joules, 2),
    wattHours: round(wattHours, 4),
    ledBulbMinutes: round(ledBulbMinutes, 2),
    analogy: `This conversation has used enough energy so far to power a ${LED_BULB_WATTS}W household smart LED lightbulb for ${ledDuration}.`,
  };
}

function buildChatPdf(messages: MessageData[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  const lineHeight = 15;
  const maxChars = 74;
  const pages: string[][] = [[]];
  let y = pageHeight - margin;

  const addLine = (line: string) => {
    if (y < margin) {
      pages.push([]);
      y = pageHeight - margin;
    }

    pages[pages.length - 1].push(line);
    y -= lineHeight;
  };

  addLine("Twents Conversation Machine");
  addLine(`Downloaded: ${new Date().toLocaleString()}`);
  addLine("");

  messages.forEach((message, index) => {
    const label = message.sender === "user" ? "You" : "Twents Bot";
    addLine(`${label}:`);
    wrapText(message.content || "(empty message)", maxChars).forEach(addLine);
    if (index < messages.length - 1) addLine("");
  });

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  const contentIds: number[] = [];

  pages.forEach((lines) => {
    const cursorY = pageHeight - margin;
    const stream = [
      "BT",
      "/F1 11 Tf",
      `${margin} ${cursorY} Td`,
      `${lineHeight} TL`,
      ...lines.map((line, index) => {
        const text = `(${escapePdfText(line)})`;
        if (index === 0) return `${text} Tj`;
        return `T* ${text} Tj`;
      }),
      "ET",
    ].join("\n");

    const contentId = addObject(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
    contentIds.push(contentId);
    pageIds.push(0);
  });

  const pagesId = objects.length + pages.length + 1;

  contentIds.forEach((contentId, index) => {
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds[index] = pageId;
  });

  addObject(
    `<< /Type /Pages /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageIds.length} >>`
  );
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${
    objects.length + 1
  } /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

// Example sources for citations
const sources = {
  "1": {
    title: "Artificial Intelligence Basics",
    url: "https://example.com/ai-basics",
    author: "John Smith",
    date: "2023-05-10",
  },
  "2": {
    title: "Machine Learning Fundamentals",
    url: "https://example.com/ml-fundamentals",
    author: "Sarah Johnson",
    date: "2022-11-22",
  },
  "3": {
    title: "Deep Learning Applications",
    url: "https://example.com/deep-learning",
    author: "Michael Chen",
    date: "2024-01-15",
  },
};

// Citation reference component to handle [number] patterns
const CitationReference = ({
  match,
  children,
}: {
  match: RegExpMatchArray;
  children: React.ReactNode;
}) => {
  const citationNumber = match[1] as keyof typeof sources;
  const source = sources[citationNumber];

  if (!source) {
    return <span>{children}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className="cursor-pointer text-blue-500 font-medium">
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h3 className="font-medium">{source.title}</h3>
          <p className="text-sm text-muted-foreground">
            By {source.author} • {source.date}
          </p>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm text-blue-500 hover:underline"
          >
            View source <span className="ml-1">↗</span>
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default function ChatExample() {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generationStage, setGenerationStage] =
    useState<GenerationStage>("idle");
  const [selectedModel] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  const lastAssistantResponseAtRef = useRef<number | null>(null);

  // Define pattern handlers
  const patternHandlers = [
    {
      pattern: /\[(\d+)\]/g,
      render: (match: RegExpMatchArray) => (
        <CitationReference match={match}>{match[0]}</CitationReference>
      ),
    },
  ];

  const handleSendMessage = async (content: string) => {
    const assistantMessageId = createMessageId("assistant");
    const sentAt = Date.now();
    const humanResponseTime =
      lastAssistantResponseAtRef.current === null
        ? null
        : Number(
            ((sentAt - lastAssistantResponseAtRef.current) / 1000).toFixed(2)
          );
    const userMessage: MessageData = {
      id: createMessageId("user"),
      content,
      sender: "user",
      metadata: {
        model: "homosapien",
        responseTime: humanResponseTime,
      },
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setGenerationStage("thinking");
    // show progress stages while we prepare and call the server
    setGenerationStage("searching");
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        content: "",
        sender: "assistant",
        metadata: {
          model: selectedModel,
          responseTime: 0,
        },
      },
    ]);

    const start = sentAt;
    const abortController = new AbortController();
    generationAbortRef.current = abortController;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content, model: selectedModel }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Error contacting model");
      }

      if (!res.body) {
        throw new Error("Model response stream was empty");
      }

      setGenerationStage("responding");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";

      const handleStreamEvent = (event: GenerateStreamEvent) => {
        if (event.type === "token" && event.token) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + event.token }
                : msg
            )
          );
          return;
        }

        if (event.type === "done") {
          lastAssistantResponseAtRef.current = Date.now();
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMessageId) return msg;

              const responseEnergy = event.energy ?? {};
              const conversationEnergy = calculateConversationEnergy(
                prev.filter((item) => item.id !== assistantMessageId),
                responseEnergy
              );

              return {
                ...msg,
                content: msg.content || "(no response)",
                metadata: {
                  model: event.model ?? selectedModel,
                  responseTime: Number(
                    ((Date.now() - start) / 1000).toFixed(2)
                  ),
                  tokens: event.tokens ?? {},
                  responseEnergy,
                  energy: conversationEnergy,
                  explanation: event.explanation ?? "",
                  resources: event.resources ?? [],
                },
              };
            })
          );
          return;
        }

        if (event.type === "error") {
          throw new Error(event.error || "Error contacting model");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffered += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          handleStreamEvent(JSON.parse(line) as GenerateStreamEvent);
        }

        if (done) break;
      }

      if (buffered.trim()) {
        handleStreamEvent(JSON.parse(buffered) as GenerateStreamEvent);
      }
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        lastAssistantResponseAtRef.current = Date.now();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: msg.content || "Generation stopped by user",
                  metadata: {
                    ...msg.metadata,
                    responseTime: Number(
                      ((Date.now() - start) / 1000).toFixed(2)
                    ),
                  },
                }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    err instanceof Error
                      ? err.message
                      : "Error contacting model",
                  metadata: { model: selectedModel, responseTime: 0 },
                }
              : msg
          )
        );
      }
    } finally {
      setIsLoading(false);
      setGenerationStage("idle");
      timeoutRef.current = null;
      generationAbortRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (generationAbortRef.current) {
      generationAbortRef.current.abort();
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;

      const stoppedMessage: MessageData = {
        id: createMessageId("assistant"),
        content: "Generation stopped by user",
        sender: "assistant",
        metadata: {
          model: selectedModel,
          responseTime: 0,
          tokens: 0,
        },
      };

      lastAssistantResponseAtRef.current = Date.now();
      setMessages((prev) => [...prev, stoppedMessage]);
      setIsLoading(false);
      setGenerationStage("idle");
    }
  };

  const handleEditMessage = (id: string, content: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, content } : msg))
    );
  };

  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  const handleDownloadChat = () => {
    if (messages.length === 0) return;

    const blob = buildChatPdf(messages);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `twents-chat-${date}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleRegenerateMessage = (id: string) => {
    const messageIndex = messages.findIndex((msg) => msg.id === id);
    if (messageIndex < 0) return;

    let userMessageIndex = messageIndex - 1;
    while (
      userMessageIndex >= 0 &&
      messages[userMessageIndex].sender !== "user"
    ) {
      userMessageIndex--;
    }

    if (userMessageIndex >= 0) {
      const userMessage = messages[userMessageIndex];
      setMessages((prev) => prev.filter((msg) => msg.id !== id));

      setIsLoading(true);
      setGenerationStage("thinking");

      timeoutRef.current = setTimeout(() => {
        setGenerationStage("searching");

        timeoutRef.current = setTimeout(() => {
          setGenerationStage("responding");

          timeoutRef.current = setTimeout(() => {
            let responseContent = "";

            if (
              userMessage.content.toLowerCase().includes("ai") ||
              userMessage.content
                .toLowerCase()
                .includes("artificial intelligence")
            ) {
              responseContent = `<think>
Regenerating response with different approach:
- Focus on practical applications
- Include more specific examples
- Reference different aspects than before
</think>

Artificial Intelligence is transforming industries across the globe [1]. 

It uses computational models to perform tasks that typically require human cognition [2]. Recent advances have enabled AI systems to demonstrate remarkable capabilities in language understanding and generation [3].

Some key applications include:
- Healthcare: Diagnostic assistance and drug discovery
- Finance: Fraud detection and algorithmic trading
- Transportation: Self-driving vehicles and route optimization`;
            } else {
              responseContent = `<think>
Regenerating with fresh perspective:
- Original query: "${userMessage.content}"
- New angle: More detailed explanation
- Include examples
</think>

[Regenerated with ${
                selectedModel === "gpt-4"
                  ? "GPT-4"
                  : selectedModel === "gpt-3.5"
                  ? "GPT-3.5"
                  : selectedModel === "claude-3"
                  ? "Claude 3"
                  : selectedModel === "gemini-pro"
                  ? "Gemini Pro"
                  : "Llama 3"
              }] Here's a different perspective on: "${userMessage.content}"

I've thought through this from a different angle and can provide additional insights...`;
            }

            const regeneratedMessage: MessageData = {
              id: createMessageId("assistant"),
              content: responseContent,
              sender: "assistant",
              metadata: {
                model: selectedModel,
                responseTime: 3.2,
                tokens: 215,
              },
            };

            lastAssistantResponseAtRef.current = Date.now();
            setMessages((prev) => [...prev, regeneratedMessage]);
            setIsLoading(false);
            setGenerationStage("idle");
            timeoutRef.current = null;

            toast.success("Response regenerated", {
              description: "A new response has been generated.",
              duration: 3000,
            });
          }, 1500);
        }, 1500);
      }, 1500);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      generationAbortRef.current?.abort();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-foreground">
      <ChatHeader />
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-3 sm:px-6">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          generationStage={generationStage}
          patternHandlers={patternHandlers}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onRegenerateMessage={handleRegenerateMessage}
        />
        <ChatFooter
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          onDownloadChat={handleDownloadChat}
          isLoading={isLoading}
          messages={messages}
        />
      </main>
    </div>
  );
}
