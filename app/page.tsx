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

function createMessageId(prefix: "user" | "assistant") {
  messageIdSequence += 1;
  return `${prefix}-${Date.now()}-${messageIdSequence}`;
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
  const [selectedModel] = useState("gpt-4");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);

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
    const userMessage: MessageData = {
      id: createMessageId("user"),
      content,
      sender: "user",
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

    const start = Date.now();
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
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: msg.content || "(no response)",
                    metadata: {
                      model: event.model ?? selectedModel,
                      responseTime: Number(
                        ((Date.now() - start) / 1000).toFixed(2)
                      ),
                      tokens: event.tokens ?? {},
                      energy: event.energy ?? {},
                      explanation: event.explanation ?? "",
                      resources: event.resources ?? [],
                    },
                  }
                : msg
            )
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
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}
