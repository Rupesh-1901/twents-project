"use client";

import * as React from "react";
import { Loader2, Mic, Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface ChatInputProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSend: (message: string) => void;
  onStopGeneration?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  tools?: {
    icon: React.ReactNode;
    label: string;
    id: string;
    type?: "toggle" | "dropdown";
    options?: { value: string; label: string }[];
    value?: string;
    onChange?: (value: string) => void;
  }[];
}

export const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      className,
      onSend,
      onStopGeneration,
      isLoading = false,
      placeholder = "Message...",
      // tools = [],
      ...props
    },
    ref
  ) => {
    const [input, setInput] = React.useState("");
    const [isRecording, setIsRecording] = React.useState(false);
    const [isTranscribing, setIsTranscribing] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const toolbarRef = React.useRef<HTMLDivElement>(null);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const mediaStreamRef = React.useRef<MediaStream | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);

    // Handle merged refs
    const mergedRef = React.useMemo(
      () => (node: HTMLTextAreaElement | null) => {
        if (node) {
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
          textareaRef.current = node;
        }
      },
      [ref]
    );

    // Handle sending message
    const handleSendMessage = React.useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || isTranscribing) return;
        onSend(input.trim());
        setInput("");
      },
      [input, isLoading, isTranscribing, onSend]
    );

    const stopMediaStream = React.useCallback(() => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }, []);

    const transcribeAudio = React.useCallback(async (audioBlob: Blob) => {
      setIsTranscribing(true);

      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "twents-input.webm");

        const res = await fetch("/api/stt", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Unable to transcribe audio");
        }

        const data = (await res.json()) as { transcript?: string };
        const transcript = data.transcript?.trim();

        if (!transcript) {
          toast.warning("No speech detected", {
            description: "Deepgram did not return any Twents words.",
          });
          return;
        }

        setInput((current) =>
          current.trim() ? `${current.trim()} ${transcript}` : transcript
        );
      } catch (err: unknown) {
        toast.error("Unable to transcribe speech", {
          description:
            err instanceof Error
              ? err.message
              : "Deepgram speech-to-text failed.",
        });
      } finally {
        setIsTranscribing(false);
      }
    }, []);

    const stopRecording = React.useCallback(() => {
      const recorder = mediaRecorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    }, []);

    const startRecording = React.useCallback(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Microphone unavailable", {
          description: "Your browser does not support audio recording.",
        });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        const recorder = new MediaRecorder(stream);

        audioChunksRef.current = [];
        mediaStreamRef.current = stream;
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          setIsRecording(false);
          stopMediaStream();

          const audioBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          audioChunksRef.current = [];

          if (audioBlob.size > 0) {
            void transcribeAudio(audioBlob);
          }
        };

        recorder.start();
        setIsRecording(true);
      } catch (err: unknown) {
        stopMediaStream();
        toast.error("Unable to access microphone", {
          description:
            err instanceof Error
              ? err.message
              : "Microphone permission was denied or unavailable.",
        });
      }
    }, [stopMediaStream, transcribeAudio]);

    const handleVoiceInput = React.useCallback(() => {
      if (isRecording) {
        stopRecording();
        return;
      }

      void startRecording();
    }, [isRecording, startRecording, stopRecording]);

    React.useEffect(() => {
      return () => {
        stopRecording();
        stopMediaStream();
      };
    }, [stopMediaStream, stopRecording]);

    // Adjust textarea padding based on toolbar height
    React.useEffect(() => {
      const adjustPadding = () => {
        if (textareaRef.current && toolbarRef.current) {
          textareaRef.current.style.paddingBottom = `${
            toolbarRef.current.offsetHeight + 8
          }px`;
        }
      };

      adjustPadding();

      // Observe toolbar size changes
      const resizeObserver = new ResizeObserver(adjustPadding);
      if (toolbarRef.current) resizeObserver.observe(toolbarRef.current);

      return () => resizeObserver.disconnect();
    }, []);

    // Auto-resize textarea
    React.useEffect(() => {
      if (!textareaRef.current) return;

      const scrollTop = textareaRef.current.scrollTop;
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
      textareaRef.current.scrollTop = scrollTop;
    }, [input]);

    return (
      <div className={cn("relative mx-auto w-full max-w-4xl", className)}>
        <form onSubmit={handleSendMessage} className="relative">
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border bg-card/95 shadow-lg shadow-foreground/5 transition-all",
              "focus-within:border-primary/45 focus-within:shadow-primary/10",
              isRecording && "border-destructive/50 shadow-destructive/10"
            )}
          >
            <textarea
              ref={mergedRef}
              placeholder={placeholder}
              className="mb-12 min-h-24 w-full resize-none border-none bg-transparent px-4 pt-4 text-[15px] leading-7 placeholder:text-muted-foreground/80 focus:outline-none focus-visible:ring-0 sm:px-5"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              rows={1}
              disabled={isLoading || isTranscribing}
              {...props}
            />

            <div
              ref={toolbarRef}
              className="absolute bottom-0 left-0 right-0 flex items-center border-t border-border/55 bg-card/85 px-3 py-2"
            >
              <div className="flex flex-wrap gap-1">
                {/* <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground flex-shrink-0 p-0"
                >
                  <PlusCircle size={14} />
                  <span className="sr-only">Add attachment</span>
                </Button> */}

                {/* {tools.map((tool) => (
                  <React.Fragment key={tool.id}>
                    {tool.type === "dropdown" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={isLoading}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-normal gap-1 px-2"
                          >
                            {tool.icon}
                            <span className="hidden sm:inline">
                              {tool.options?.find(
                                (opt) => opt.value === tool.value
                              )?.label || tool.label}
                            </span>
                            <ChevronDown size={12} className="opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {tool.options?.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              className={cn(
                                "text-xs cursor-pointer",
                                tool.value === option.value &&
                                  "bg-muted font-medium"
                              )}
                              onClick={() => {
                                tool.onChange?.(option.value);
                              }}
                            >
                              {option.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Toggle
                        pressed={activeTools.includes(tool.id)}
                        onPressedChange={() => toggleTool(tool.id)}
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-7 rounded-md px-2 flex items-center gap-1 text-xs  me-2",
                          activeTools.includes(tool.id)
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground"
                        )}
                        disabled={isLoading}
                      >
                        {tool.icon}
                        <span className="hidden sm:inline">{tool.label}</span>
                      </Toggle>
                    )}
                  </React.Fragment>
                ))} */}
              </div>

              <div className="ml-auto flex items-center gap-1">
                {isRecording && (
                  <span className="mr-2 hidden items-center gap-2 text-xs font-medium text-destructive sm:flex">
                    <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    Opname
                  </span>
                )}
                <Button
                  type="button"
                  onClick={handleVoiceInput}
                  size="sm"
                  variant="ghost"
                  disabled={isLoading || isTranscribing}
                  className={cn(
                    "h-8 w-8 rounded-md flex-shrink-0 p-0",
                    isRecording
                      ? "text-destructive hover:text-destructive hover:bg-destructive/10"
                      : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                  )}
                  title={
                    isRecording
                      ? "Stop Twents voice input"
                      : "Start Twents voice input"
                  }
                >
                  {isTranscribing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isRecording ? (
                    <Square size={13} className="fill-destructive" />
                  ) : (
                    <Mic size={14} />
                  )}
                  <span className="sr-only">
                    {isRecording
                      ? "Stop Twents voice input"
                      : "Start Twents voice input"}
                  </span>
                </Button>

                {isLoading ? (
                  <Button
                    type="button"
                    onClick={onStopGeneration}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 flex-shrink-0 rounded-md p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Square size={14} className="fill-destructive" />
                    <span className="sr-only">Stop generation</span>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    disabled={!input.trim() || isTranscribing}
                    className={cn(
                      "h-8 w-8 rounded-md flex-shrink-0 p-0",
                      input.trim()
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <Send size={14} />
                    <span className="sr-only">Send message</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }
);

ChatInput.displayName = "ChatInput";
