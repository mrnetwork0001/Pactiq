"use client";

import React, { useState } from "react";
import { Copy, Check, Send } from "lucide-react";
import { shareLinks } from "@/lib/share";
import { btn } from "./ui";

/** X / Telegram / copy-link buttons. */
export function ShareButtons({ text, url, compact = false }: { text: string; url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const links = shareLinks(text, url);
  const cls = btn("outline", "sm");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <div className={`flex flex-wrap gap-2.5 ${compact ? "" : "w-full"}`}>
      <a href={links.x} target="_blank" rel="noreferrer" className={cls}>
        <span className="font-black">𝕏</span> Post
      </a>
      <a href={links.telegram} target="_blank" rel="noreferrer" className={cls}>
        <Send className="w-3.5 h-3.5" /> Telegram
      </a>
      <button type="button" onClick={copy} className={cls}>
        {copied ? <Check className="w-3.5 h-3.5 text-kept" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
