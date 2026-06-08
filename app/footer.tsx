// 3. ChatFooter.tsx
import { ChatInput } from "@/components/chat-input";

interface ChatFooterProps {
  onSendMessage: (content: string) => void;
  onStopGeneration: () => void;
  isLoading: boolean;
}

export function ChatFooter({
  onSendMessage,
  onStopGeneration,
  isLoading,
}: ChatFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-3 border-t border-border/60 bg-background/78 px-3 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
      <ChatInput
        onSend={onSendMessage}
        onStopGeneration={onStopGeneration}
        isLoading={isLoading}
        placeholder="Wat hef ie op 't hart?"
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
