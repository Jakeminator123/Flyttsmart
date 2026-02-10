"use client"

import { useState, useMemo } from "react"
import { Bookmark, Copy, Check, GripHorizontal, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  generateBookmarklet,
  type BookmarkletData,
} from "@/lib/bookmarklet/generate"

interface BookmarkletButtonProps {
  data: BookmarkletData
  className?: string
}

export function BookmarkletButton({ data, className }: BookmarkletButtonProps) {
  const [copied, setCopied] = useState(false)

  const bookmarkletHref = useMemo(() => generateBookmarklet(data), [data])

  async function handleCopy() {
    await navigator.clipboard.writeText(bookmarkletHref)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">
            Auto-ifyllning Skatteverket
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          Dra knappen till bokmärkesfältet. Klicka på den när du är på
          Skatteverkets flyttanmälan — dina uppgifter fylls i automatiskt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Draggable bookmarklet link */}
        <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3">
          <GripHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
          <a
            href={bookmarkletHref}
            onClick={(e) => e.preventDefault()}
            draggable
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 cursor-grab active:cursor-grabbing"
          >
            <Bookmark className="h-4 w-4" />
            Flytt.io Fyll i
          </a>
          <span className="text-xs text-muted-foreground">
            ← Dra hit
          </span>
        </div>

        {/* Alternative: copy to clipboard */}
        <Button
          onClick={handleCopy}
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Kopierad!" : "Kopiera bokmärke (för mobil)"}
        </Button>

        {/* Instructions */}
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium flex items-center gap-1">
            <Info className="h-3 w-3" /> Så här gör du:
          </p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Dra &quot;Flytt.io Fyll i&quot; till bokmärkesfältet</li>
            <li>Gå till Skatteverkets flyttanmälan och logga in med BankID</li>
            <li>Klicka på bokmärket — uppgifterna fylls i!</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
