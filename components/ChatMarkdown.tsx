import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal Markdown renderer for sommelier replies.
 *
 * Supports the subset GPT actually emits in short answers: paragraphs,
 * headings (rendered as bold lines), bullet and numbered lists, **bold**,
 * __bold__ and *italic*. Builds React elements only (never innerHTML),
 * so model output can't inject markup.
 */

// **bold** | __bold__ | *italic* (no spaces just inside the asterisks)
const INLINE_PATTERN = /\*\*(.+?)\*\*|__(.+?)__|\*([^\s*](?:[^*]*?[^\s*])?)\*/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_PATTERN.lastIndex = 0;

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const bold = match[1] ?? match[2];
    nodes.push(
      bold !== undefined ? (
        <strong key={match.index} className="font-semibold">{bold}</strong>
      ) : (
        <em key={match.index}>{match[3]}</em>
      )
    );
    lastIndex = INLINE_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const listKind = bullet ? "ul" : numbered ? "ol" : null;
    const last = blocks[blocks.length - 1];

    if (heading) {
      blocks.push({ kind: "heading", text: heading[1] });
    } else if (listKind) {
      const item = (bullet ?? numbered)![1];
      if (last && last.kind === listKind) last.items.push(item);
      else blocks.push({ kind: listKind, items: [item] });
    } else {
      blocks.push({ kind: "paragraph", text: line });
    }
  }
  return blocks;
}

export function ChatMarkdown({ content, className }: { content: string; className?: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "heading":
            return <p key={i} className="font-semibold">{renderInline(block.text)}</p>;
          case "ul":
          case "ol": {
            const List = block.kind;
            return (
              <List
                key={i}
                className={cn("space-y-1 pl-5", block.kind === "ul" ? "list-disc" : "list-decimal")}
              >
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </List>
            );
          }
          default:
            return <p key={i}>{renderInline(block.text)}</p>;
        }
      })}
    </div>
  );
}
