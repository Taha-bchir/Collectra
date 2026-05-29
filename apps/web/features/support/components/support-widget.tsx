"use client"

import { useState } from "react"
import { Bot, MessageSquareText, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SupportChatbot } from "@/features/support/components/support-chatbot"

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {!isOpen ? (
        <Button
          type="button"
          size="icon-lg"
          className="h-12 w-12 rounded-full shadow-md shadow-black/10"
          aria-label="Open support chat"
          onClick={() => setIsOpen(true)}
        >
          <MessageSquareText className="h-4.5 w-4.5" />
        </Button>
      ) : null}

      {isOpen ? (
        <div className="pointer-events-none fixed inset-0 z-50 bg-black/25 sm:bg-transparent">
          <div className="pointer-events-auto absolute bottom-4 right-4 flex h-[min(76vh,680px)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl sm:bottom-6 sm:right-6 sm:w-110 lg:w-120">
            <div className="flex items-center justify-between border-b border-border/60 bg-card px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Support assistant</p>
                  <p className="text-xs text-muted-foreground">Ask about campaigns, imports, payments, or settings</p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                aria-label="Close support chat"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden bg-background">
              <SupportChatbot />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}