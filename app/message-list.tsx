import {
  GenerationStage,
  GenerationStatus,
} from "@/components/generation-status";
import { Message, PatternHandler } from "@/components/message";
import { Copy, Loader2, RefreshCw, Trash2, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface MessageData {
  id: string;
  content: string;
  sender: "user" | "assistant";
  metadata?: Record<string, unknown>;
}

interface MessageListProps {
  messages: MessageData[];
  isLoading: boolean;
  generationStage: GenerationStage;
  patternHandlers: PatternHandler[];
  onEditMessage: (id: string, content: string) => void;
  onDeleteMessage: (id: string) => void;
  onRegenerateMessage: (id: string) => void;
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function formatMetadataLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").trim();
}

function MetadataValue({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === "") {
    return <>unknown</>;
  }

  if (typeof value === "object") {
    return (
      <div className="space-y-1">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {formatMetadataLabel(key)}:
            </span>
            <span className="font-medium">{String(item ?? "unknown")}</span>
          </div>
        ))}
      </div>
    );
  }

  return <>{String(value)}</>;
}

function MessageInfoPanel({ message }: { message: MessageData }) {
  const metadata = message.metadata ?? {};
  const energy = asRecord(metadata.energy);
  const isHuman = message.sender === "user";

  const rows = [
    {
      label: "Model",
      value: isHuman ? "homosapien" : metadata.model,
    },
    {
      label: "Response Time",
      value: isHuman
        ? metadata.responseTime
          ? `${String(metadata.responseTime)}s`
          : "unknown"
        : metadata.responseTime
        ? `${String(metadata.responseTime)}s`
        : "unknown",
    },
    {
      label: "Tokens",
      value: isHuman ? "unknown" : metadata.tokens,
    },
    {
      label: "Energy consumed so far",
      value: isHuman
        ? "unknown"
        : energy
        ? `${String(energy.wattHours ?? "unknown")} Wh`
        : "unknown",
    },
  ];

  return (
    <aside className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Message Info
      </h4>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[5.5rem_1fr] gap-2">
            <div className="text-muted-foreground">{row.label}:</div>
            <div className="min-w-0 break-words font-medium">
              <MetadataValue value={row.value} />
            </div>
          </div>
        ))}
      </div>

      {!isHuman && energy && (
        <div className="mt-3 rounded-md border border-border/70 bg-muted/35 p-2">
          <div className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1">
            <div className="text-muted-foreground">Joules:</div>
            <div className="font-medium">
              {String(energy.joules ?? "unknown")}
            </div>

            <div className="text-muted-foreground">10W LED:</div>
            <div className="font-medium">
              {String(energy.ledBulbMinutes ?? "unknown")} min
            </div>
          </div>
          {typeof energy.analogy === "string" && (
            <div className="mt-2 whitespace-pre-wrap leading-5">
              {energy.analogy}
            </div>
          )}
        </div>
      )}

      {!isHuman &&
        typeof metadata.explanation === "string" &&
        metadata.explanation && (
          <div className="mt-3">
            <div className="mb-1 text-muted-foreground">Explanation:</div>
            <div className="whitespace-pre-wrap font-medium leading-5">
              {metadata.explanation}
            </div>
          </div>
        )}

      {!isHuman &&
        Array.isArray(metadata.resources) &&
        metadata.resources.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-muted-foreground">Resources:</div>
            <ul className="list-inside list-disc space-y-1">
              {metadata.resources.map((resource, index) => (
                <li key={index} className="break-words font-medium">
                  {String(resource)}
                </li>
              ))}
            </ul>
          </div>
        )}
    </aside>
  );
}

export function MessageList({
  messages,
  isLoading,
  generationStage,
  patternHandlers,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
}: MessageListProps) {
  const [copying, setCopying] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [speechLoading, setSpeechLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlsRef = useRef<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const audioUrls = audioUrlsRef.current;

    return () => {
      audioRef.current?.pause();
      Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages.length, isLoading, generationStage]);

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopying(id);

    toast.success("Copied to clipboard", {
      description: "Message content has been copied to your clipboard.",
      duration: 2000,
    });

    setTimeout(() => {
      setCopying(null);
    }, 1000);
  };

  const stopSpeech = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(null);
  };

  const handleSpeak = async (id: string, content: string) => {
    if (speaking === id) {
      stopSpeech();
      return;
    }

    stopSpeech();
    setSpeechLoading(id);

    try {
      let audioUrl = audioUrlsRef.current[id];

      if (!audioUrl) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: content }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Unable to generate speech");
        }

        const audioBlob = await res.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        audioUrlsRef.current[id] = audioUrl;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setSpeaking(id);

      audio.onended = () => {
        setSpeaking(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setSpeaking(null);
        audioRef.current = null;
        toast.error("Unable to play speech", {
          description: "The generated Twents audio could not be played.",
        });
      };

      await audio.play();
    } catch (err: unknown) {
      setSpeaking(null);
      audioRef.current = null;

      toast.error("Unable to read response aloud", {
        description:
          err instanceof Error
            ? err.message
            : "Gemini TTS failed to generate audio.",
      });
    } finally {
      setSpeechLoading((current) => (current === id ? null : current));
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-1 py-5 sm:px-0 sm:py-8">
      {messages.length === 0 ? (
        <div className="flex min-h-[52vh] items-center justify-center">
          <div className="max-w-xl rounded-lg border border-border/70 bg-card/82 px-6 py-5 text-center shadow-sm shadow-foreground/5">
            {/* <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-md bg-primary text-lg font-black text-primary-foreground">
              T
            </div> */}
            <h2 className="text-lg font-semibold tracking-tight">
              Moi. Woar wo&apos;w oaver proaten?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              &apos;t Gesprek steet kloar.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {messages.map((message) => {
            const actionButtons =
              message.sender === "assistant"
                ? [
                    {
                      id: "speak",
                      icon:
                        speechLoading === message.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Volume2
                            size={14}
                            className={
                              speaking === message.id ? "text-primary" : ""
                            }
                          />
                        ),
                      onClick: () => handleSpeak(message.id, message.content),
                      title:
                        speaking === message.id
                          ? "Stop reading response"
                          : "Read response aloud",
                      position: "inside" as const,
                    },
                    {
                      id: "copy",
                      icon: (
                        <Copy
                          size={14}
                          className={
                            copying === message.id ? "text-primary" : ""
                          }
                        />
                      ),
                      onClick: () => handleCopy(message.id, message.content),
                      title: "Copy message",
                      position: "inside" as const,
                    },
                    {
                      id: "regenerate",
                      icon: <RefreshCw size={14} />,
                      onClick: () => onRegenerateMessage(message.id),
                      title: "Regenerate response",
                      position: "inside" as const,
                    },
                  ]
                : [
                    {
                      id: "copy",
                      icon: (
                        <Copy
                          size={16}
                          className={
                            copying === message.id ? "text-primary" : ""
                          }
                        />
                      ),
                      onClick: () => handleCopy(message.id, message.content),
                      title: "Copy message",
                      position: "outside" as const,
                    },
                    {
                      id: "delete",
                      icon: <Trash2 size={16} />,
                      onClick: () => onDeleteMessage(message.id),
                      title: "Delete message",
                      position: "outside" as const,
                      className: "hover:text-destructive",
                    },
                  ];

            return (
              <div
                key={message.id}
                className="grid w-full gap-3 lg:grid-cols-[14rem_minmax(0,1fr)_14rem] lg:items-start"
              >
                <div
                  className={
                    message.sender === "assistant" ? "" : "hidden lg:block"
                  }
                >
                  {message.sender === "assistant" && (
                    <MessageInfoPanel message={message} />
                  )}
                </div>

                <Message
                  content={message.content}
                  sender={message.sender}
                  actionButtons={actionButtons}
                  editable={message.sender === "user"}
                  onEdit={(content) => onEditMessage(message.id, content)}
                  patternHandlers={
                    message.sender === "assistant"
                      ? patternHandlers
                      : undefined
                  }
                />

                <div
                  className={message.sender === "user" ? "" : "hidden lg:block"}
                >
                  {message.sender === "user" && (
                    <MessageInfoPanel message={message} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading && (
        <GenerationStatus stage={generationStage} className="mt-6" />
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
