import {
  GenerationStage,
  GenerationStatus,
} from "@/components/generation-status";
import { Message, PatternHandler } from "@/components/message";
import { Copy, Info, Loader2, RefreshCw, Trash2, Volume2 } from "lucide-react";
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

export function MessageList({
  messages,
  isLoading,
  generationStage,
  patternHandlers,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
}: MessageListProps) {
  const [metadataVisible, setMetadataVisible] = useState<
    Record<string, boolean>
  >({});
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

  const toggleMetadata = (id: string) => {
    setMetadataVisible((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-md bg-primary text-lg font-black text-primary-foreground">
              T
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              Moi. Waar wo&apos;w oaver proaten?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              &apos;t Gesprek steet kloar.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {messages.map((message) => {
            const energy = asRecord(message.metadata?.energy);
            const actionButtons =
              message.sender === "assistant"
                ? [
                    {
                      id: "info",
                      icon: <Info size={14} />,
                      onClick: () => toggleMetadata(message.id),
                      title: "View message info",
                      position: "inside" as const,
                      className: metadataVisible[message.id]
                        ? "text-primary"
                        : "",
                    },
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
              <div key={message.id} className="w-full">
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

                {message.sender === "assistant" &&
                  message.metadata &&
                  metadataVisible[message.id] && (
                    <div className="mt-2 max-w-[88vw] rounded-lg border border-border/70 bg-card/92 p-4 text-sm shadow-md shadow-foreground/5 sm:ml-10 sm:max-w-2xl">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold">Message Info</h4>
                        <button
                          onClick={() => toggleMetadata(message.id)}
                          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Close
                        </button>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-[minmax(92px,0.8fr)_minmax(0,1.2fr)] gap-x-4 gap-y-2">
                          <div className="text-xs text-muted-foreground">
                            Model:
                          </div>
                          <div className="break-words text-xs font-medium">
                            {String(message.metadata.model ?? "-")}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Response Time:
                          </div>
                          <div className="text-xs font-medium">
                            {String(message.metadata.responseTime ?? "-")}
                            {message.metadata.responseTime ? "s" : ""}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Tokens:
                          </div>
                          <div className="text-xs font-medium">
                            {message.metadata.tokens ? (
                              <div className="space-y-1">
                                {typeof message.metadata.tokens ===
                                "object" ? (
                                  Object.entries(
                                    message.metadata.tokens
                                  ).map(([key, value]) => (
                                    <div
                                      key={key}
                                      className="flex items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="text-muted-foreground">
                                        {key}:
                                      </div>
                                      <div className="font-medium">
                                        {String(value)}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  String(message.metadata.tokens)
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </div>
                        </div>

                        {energy && (
                          <div className="rounded-md border border-border/70 bg-muted/35 p-3">
                            <div className="mb-2 text-xs font-medium text-muted-foreground">
                              Energy:
                            </div>
                            <div className="grid grid-cols-[minmax(92px,0.8fr)_minmax(0,1.2fr)] gap-x-4 gap-y-2 text-xs">
                              <div className="text-muted-foreground">
                                Joules:
                              </div>
                              <div className="font-medium">
                                {String(energy.joules ?? "-")}
                              </div>

                              <div className="text-muted-foreground">
                                Watt-hours:
                              </div>
                              <div className="font-medium">
                                {String(energy.wattHours ?? "-")} Wh
                              </div>

                              <div className="text-muted-foreground">
                                10W LED:
                              </div>
                              <div className="font-medium">
                                {String(energy.ledBulbMinutes ?? "-")} min
                              </div>
                            </div>
                            {typeof energy.analogy === "string" && (
                              <div className="mt-3 whitespace-pre-wrap text-xs font-medium leading-5">
                                {energy.analogy}
                              </div>
                            )}
                          </div>
                        )}

                        {typeof message.metadata.explanation === "string" &&
                          message.metadata.explanation && (
                            <div>
                              <div className="mb-1 text-xs text-muted-foreground">
                                Explanation:
                              </div>
                              <div className="whitespace-pre-wrap text-xs font-medium leading-5">
                                {String(message.metadata.explanation)}
                              </div>
                            </div>
                          )}

                        {Array.isArray(message.metadata.resources) &&
                          message.metadata.resources.length > 0 && (
                            <div>
                              <div className="mb-1 text-xs text-muted-foreground">
                                Resources:
                              </div>
                              <ul className="list-inside list-disc text-xs">
                                {message.metadata.resources.map((resource, i) => (
                                  <li
                                    key={i}
                                    className="break-words font-medium"
                                  >
                                    {String(resource)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                        {Object.entries(message.metadata)
                          .filter(
                            ([key]) =>
                              ![
                                "model",
                                "responseTime",
                                "tokens",
                                "energy",
                                "explanation",
                                "resources",
                              ].includes(key)
                          )
                          .map(([key, value]) => (
                            <div
                              key={key}
                              className="grid grid-cols-[minmax(92px,0.8fr)_minmax(0,1.2fr)] gap-4"
                            >
                              <div className="text-xs capitalize text-muted-foreground">
                                {key.replace(/([A-Z])/g, " $1").trim()}:
                              </div>
                              <div className="break-words text-xs font-medium">
                                {String(value)}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
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
