import { ChatInput } from "@/components/chat-input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ChatMessage {
  content: string;
  sender: "user" | "assistant";
}

interface ChatFooterProps {
  onSendMessage: (content: string) => void;
  onStopGeneration: () => void;
  onDownloadChat: () => void;
  isLoading: boolean;
  messages: ChatMessage[];
}

export function ChatFooter({
  onSendMessage,
  onStopGeneration,
  onDownloadChat,
  isLoading,
  messages,
}: ChatFooterProps) {
  const hasStartedChat = messages.length > 0;

  return (
    <div className="sticky bottom-0 z-10 -mx-3 border-t border-border/60 bg-background/78 px-3 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
      {hasStartedChat && (
        <div className="mx-auto mb-2 flex w-full max-w-4xl justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownloadChat}
            className="h-8 gap-2 rounded-md border-border/80 bg-card/90 px-3 text-xs font-medium shadow-sm shadow-foreground/5"
            title="Download chat as PDF"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      )}
      <ChatInput
        onSend={onSendMessage}
        onStopGeneration={onStopGeneration}
        isLoading={isLoading}
        placeholder="Wat hef ie op 't hatte?"
        // tools={[
        //   {
        //     id: "search",
        //     label: "Search",
        //     icon: <Globe size={14} className="mr-1" />,
        //   },
        //   {
        //     id: "think",
        //     label: "Think",
        //     icon: <Sparkles size={14} className="mr-1" />,
        //   },
        //   {
        //     id: "model",
        //     label: "Model",
        //     icon: <Bot size={14} className="mr-1" />,
        //     type: "dropdown",
        //     options: models,
        //     value: selectedModel,
        //     onChange: setSelectedModel,
        //   },
        // ]}
      />
    </div>
  );
}
