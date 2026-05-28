import { strings } from "@/lib/strings"

export default function SupportPage() {
  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 lg:px-8 lg:py-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {strings.nav_support}
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{strings.support_title}</h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            The chatbot opens from the floating button in the bottom-right corner on dashboard pages.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <p className="text-sm font-medium text-foreground">How to use it</p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Click the chat icon at the bottom-right of the screen to open the assistant. You can ask about CSV imports,
            payment links, overview stats, campaigns, or account settings.
          </p>
        </div>
      </div>
    </div>
  )
}