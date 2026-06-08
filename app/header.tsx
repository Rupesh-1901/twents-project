import { ModeToggle } from "./mode-toggle";

export function ChatHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-primary/20 bg-primary text-sm font-black text-primary-foreground shadow-sm">
            T
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              Twents Dialect Chatbot
            </h1>
            <p className="truncate text-xs font-medium text-muted-foreground">
              Moi, wat wil ie weten?
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm sm:block">
            Tweants
          </div>
          {ModeToggle()}
        </div>
      </div>
    </header>
  );
}
