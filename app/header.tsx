import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ModeToggle } from "./mode-toggle";

export function ChatHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {/* <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-primary/20 bg-primary text-sm font-black text-primary-foreground shadow-sm">
            T
          </div> */}
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              Twents Conversation Machine
            </h1>
            <p className="truncate text-xs font-medium text-muted-foreground">
              How well do machines speak your language?
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* <div className="hidden rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm sm:block">
            Tweants
          </div> */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <span className="sm:hidden">About</span>
                <span className="hidden sm:inline">About the prototype</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={10}
              className="max-h-[calc(100vh-7rem)] w-[min(64rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border-border/70 bg-card/95 p-0 shadow-xl shadow-foreground/10"
            >
              <div className="border-b border-border/70 px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight">
                  The Twents Conversation Machine
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  An artist project exploring how well machines can speak
                  Twents.
                </p>
              </div>
              <div className="grid gap-x-8 gap-y-3 px-4 py-4 text-sm leading-6 md:grid-cols-2">
                <p className="text-muted-foreground">
                  The Twents Conversation Machine is an artist project being
                  built to explore how well machines can speak Twents, a Low
                  Saxon &quot;dialect&quot; spoken in the east of the
                  Netherlands.
                </p>
                <p className="text-muted-foreground">
                  It was initiated by Clare Poolman, artist in residence at
                  Drawing Centre Diepenheim in 2026 with the Institut Français.
                  Her work explores how language emerges and circulates and asks
                  what role we want machines to play in our speaking, thinking
                  and creating.
                </p>
                <p className="text-muted-foreground">
                  This prototype is currently under construction by  
                  {" "}
                  <a
                    href="https://www.linkedin.com/in/rupesh-mishra-5b2b701b1/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                     Rupesh
                  </a>, 
                  masters student at the
                  University of Twente. Set up on a shoestring, it draws on data
                  already present in the Mistral model from Twents text
                  available on the internet.
                </p>
                <p className="text-muted-foreground">
                  Programmed to communicate solely in Twents, it allows you to
                  experience the limitations and possibilities of such a system
                  today. You may converse with the machine but it is unable to
                  learn from you or be changed by interacting with you.
                </p>
                <p className="text-muted-foreground">
                  And as one Tukker remarked, &quot;It&apos;s like an
                  Amsterdammer who&apos;s thinking he knows Twents...&quot;
                </p>
                <p className="text-muted-foreground">
                  Thanks to all those who have contributed, including: Martien
                  Jalink, Jamila Blokzijl, Conny, Gerry, Frits, Martin,
                  Martine...
                </p>
                <p className="space-y-1 text-muted-foreground md:col-span-2">
                  <span className="block font-medium text-foreground">
                    More information + contact:
                  </span>
                  <a
                    href="https://linktr.ee/clare.poolman"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-words text-primary hover:underline"
                  >
                    https://linktr.ee/clare.poolman
                  </a>
                  <a
                    href="https://drawingcentre.nl/residenties/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-words text-primary hover:underline"
                  >
                    https://drawingcentre.nl/residenties/
                  </a>
                </p>
              </div>
            </PopoverContent>
          </Popover>
          {ModeToggle()}
        </div>
      </div>
    </header>
  );
}
