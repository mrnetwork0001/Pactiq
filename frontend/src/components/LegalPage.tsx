import React from "react";
import Link from "next/link";
import { Wordmark } from "./Header";
import { Footer } from "./Footer";

export const LEGAL_UPDATED = "23 November 2026";
/** Shown on both pages when set. Leave NEXT_PUBLIC_CONTACT_EMAIL empty to hide the contact line. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";

/** Shared frame for the terms and privacy pages: plain, readable, one column. */
export function LegalPage({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-ink">
        <div className="max-w-[calc(75vw_+_324px)] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Wordmark />
          <Link href="/app" className="text-sm font-semibold text-seal hover:underline">
            Open the app
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-24">
        <div className="kicker">Last updated {LEGAL_UPDATED}</div>
        <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-tight mt-3">{title}</h1>
        <p className="text-lg text-ink-2 leading-relaxed mt-5 border-b border-ink pb-8">{lead}</p>
        <div className="legal">{children}</div>
        {CONTACT_EMAIL && (
          <p className="text-sm text-ink-2 mt-12 border-t border-rule pt-6">
            Questions about this page:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-quill underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
