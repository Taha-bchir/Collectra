"use client"

import Link from "next/link"
import { FormEvent, useEffect, useRef, useState } from "react"
import { MessageSquareText, SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { strings } from "@/lib/strings"

type ChatAction = {
  label: string
  href: string
}

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
  actions?: ChatAction[]
}

type BotReply = {
  text: string
  actions?: ChatAction[]
}

const quickQuestions = [
  strings.support_question_csv,
  strings.support_question_payments,
  strings.support_question_invoice,
  strings.support_question_account,
]

function getSuggestedActions(message: string): ChatAction[] | undefined {
  const normalized = message.toLowerCase()

  if (/csv|import|spreadsheet|upload/.test(normalized)) {
    return [{ label: strings.support_link_campaigns, href: "/campaigns" }]
  }

  if (/payment link|payment links|pay link|send payment|recover/.test(normalized)) {
    return [{ label: strings.support_link_campaigns, href: "/campaigns" }]
  }

  if (/stripe invoice|invoice|hosted invoice/.test(normalized)) {
    return [{ label: strings.support_link_payments, href: "/campaigns" }]
  }

  if (/account|settings|password|profile|email/.test(normalized)) {
    return [{ label: strings.support_link_account, href: "/settings/account" }]
  }

  if (/overview|dashboard|stats|metric|summary/.test(normalized)) {
    return [{ label: strings.support_link_overview, href: "/overview" }]
  }

  return undefined
}

function getBotReply(message: string): BotReply {
  const normalized = message.toLowerCase()

  if (/csv|import|spreadsheet|upload/.test(normalized)) {
    return {
      text: strings.support_answer_csv,
      actions: [{ label: strings.support_link_campaigns, href: "/campaigns" }],
    }
  }

  if (/payment link|payment links|pay link|send payment|recover/.test(normalized)) {
    return {
      text: strings.support_answer_payments,
      actions: [{ label: strings.support_link_campaigns, href: "/campaigns" }],
    }
  }

  if (/stripe invoice|invoice|hosted invoice/.test(normalized)) {
    return {
      text: strings.support_answer_invoice,
      actions: [{ label: strings.support_link_payments, href: "/campaigns" }],
    }
  }

  if (/account|settings|password|profile|email/.test(normalized)) {
    return {
      text: strings.support_answer_account,
      actions: [{ label: strings.support_link_account, href: "/settings/account" }],
    }
  }

  if (/overview|dashboard|stats|metric|summary/.test(normalized)) {
    return {
      text: strings.support_answer_overview,
      actions: [{ label: strings.support_link_overview, href: "/overview" }],
    }
  }

  return { text: strings.support_fallback }
}

export function SupportChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: strings.support_welcome,
      actions: [
        { label: strings.support_link_overview, href: "/overview" },
        { label: strings.support_link_campaigns, href: "/campaigns" },
      ],
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const nextId = useRef(2)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  const appendMessage = (message: Omit<ChatMessage, "id">) => {
    const id = nextId.current
    nextId.current += 1
    setMessages((current) => [...current, { id, ...message }])
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const question = inputValue.trim()
    if (!question || isSending) return

    appendMessage({ role: "user", text: question })
    setInputValue("")
    setIsSending(true)

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      })

      if (!response.ok) {
        throw new Error("Chat request failed")
      }

      const data = (await response.json()) as { text?: string }
      const text = data.text?.trim()

      if (!text) {
        throw new Error("Empty chat response")
      }

      appendMessage({
        role: "assistant",
        text,
        actions: getSuggestedActions(question),
      })
    } catch {
      const reply = getBotReply(question)
      appendMessage({
        role: "assistant",
        text: reply.text,
        actions: reply.actions ?? getSuggestedActions(question),
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleQuickQuestion = (question: string) => {
    setInputValue(question)
  }

  const handleReset = () => {
    setMessages([
      {
        id: 1,
        role: "assistant",
        text: strings.support_welcome,
        actions: [
          { label: strings.support_link_overview, href: "/overview" },
          { label: strings.support_link_campaigns, href: "/campaigns" },
        ],
      },
    ])
    setInputValue("")
    nextId.current = 2
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ScrollArea className="h-full min-h-0 flex-1">
        <div className="space-y-4 px-4 py-4 pb-6 sm:px-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageSquareText className="h-4 w-4" />
                </div>
              ) : null}

              <div
                className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                  message.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "border border-border/60 bg-muted/40 text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</p>

                {message.actions?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <Button
                        key={action.href}
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-full border-border/60 bg-background px-2.5 text-xs shadow-none hover:bg-muted"
                      >
                        <Link href={action.href}>{action.label}</Link>
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 bg-card px-4 py-3 sm:px-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {quickQuestions.map((question) => (
            <Button
              key={question}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-full border-border/60 bg-background px-2.5 text-[11px] shadow-none hover:bg-muted"
              onClick={() => handleQuickQuestion(question)}
            >
              {question}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={strings.support_input_placeholder}
            className="h-11 rounded-md border-border/70 bg-background text-sm shadow-none"
          />
          <Button type="submit" className="h-11 shrink-0 gap-2 rounded-md px-4" disabled={isSending}>
            <SendHorizontal className="h-4 w-4" />
            {isSending ? "..." : strings.support_send}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 rounded-md border-border/70 bg-background px-4 shadow-none hover:bg-muted"
            onClick={handleReset}
          >
            {strings.support_reset}
          </Button>
        </form>
      </div>
    </div>
  )
}