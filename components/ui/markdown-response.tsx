"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

/**
 * Render AI response text with basic markdown formatting and citation badges.
 * Lightweight — no external markdown library needed.
 */
export function MarkdownResponse({
  text,
  truncateAt = 0,
  className = "",
}: {
  text: string;
  truncateAt?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = truncateAt > 0 && text.length > truncateAt;
  const displayText = shouldTruncate && !expanded ? text.slice(0, truncateAt) + "..." : text;

  return (
    <div className={className}>
      <div
        className="ai-response-prose text-sm text-foreground leading-[1.7] space-y-2"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(displayText) }}
      />
      {shouldTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {expanded ? t("common.showLess") : t("common.showAll")}
        </button>
      )}
    </div>
  );
}

/** Convert markdown text to HTML with citation badges */
function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Citation badges: [1], [2], etc. → small green pills
  html = html.replace(
    /\[(\d{1,2})\]/g,
    '<span class="ai-citation-badge">$1</span>'
  );

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<em>$1</em>");

  // Headers: ### → h4, ## → h3 (keep small in context)
  html = html.replace(/^### (.+)$/gm, '<h4 class="ai-h4">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="ai-h3">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h3 class="ai-h3">$1</h3>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="ai-code">$1</code>');

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-link">$1</a>'
  );

  // Tables: detect | col | col | patterns
  html = renderTables(html);

  // Lists and paragraphs (process line by line)
  html = renderListsAndParagraphs(html);

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderTables(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inTable = false;
  let headerDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isTableRow = line.startsWith("|") && line.endsWith("|") && line.includes("|");
    const isSeparator = /^\|[\s\-:|]+\|$/.test(line);

    if (isTableRow && !isSeparator) {
      if (!inTable) {
        result.push('<table class="ai-table">');
        inTable = true;
        headerDone = false;
      }
      const cells = line.split("|").filter((c) => c.trim() !== "");
      const tag = !headerDone ? "th" : "td";
      result.push("<tr>" + cells.map((c) => `<${tag}>${c.trim()}</${tag}>`).join("") + "</tr>");
      if (!headerDone) headerDone = true;
    } else if (isSeparator && inTable) {
      // skip separator row
    } else {
      if (inTable) {
        result.push("</table>");
        inTable = false;
      }
      result.push(lines[i]);
    }
  }
  if (inTable) result.push("</table>");
  return result.join("\n");
}

function renderListsAndParagraphs(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip if it's already an HTML tag
    if (trimmed.startsWith("<h") || trimmed.startsWith("<table") || trimmed.startsWith("</table") || trimmed.startsWith("<tr")) {
      closeOpenLists();
      result.push(line);
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (!inUl) { closeOl(); result.push('<ul class="ai-ul">'); inUl = true; }
      result.push(`<li>${ulMatch[1]}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inOl) { closeUl(); result.push('<ol class="ai-ol">'); inOl = true; }
      result.push(`<li>${olMatch[1]}</li>`);
      continue;
    }

    // Regular text
    closeOpenLists();
    if (trimmed === "") {
      result.push("");
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }
  closeOpenLists();
  return result.join("\n");

  function closeUl() { if (inUl) { result.push("</ul>"); inUl = false; } }
  function closeOl() { if (inOl) { result.push("</ol>"); inOl = false; } }
  function closeOpenLists() { closeUl(); closeOl(); }
}
