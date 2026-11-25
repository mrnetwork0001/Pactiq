"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Kicker, Mark, Notice, btn } from "./ui";

/** The site-password form. It posts to /api/gate, which checks the password and decides where to send the visitor. */
export function GateForm() {
  const params = useSearchParams();
  return (
    <form method="post" action="/api/gate" className="sheet rounded-md w-full max-w-sm p-8 space-y-5">
      <div className="flex items-center gap-2.5">
        <Mark size={34} />
        <span className="font-display text-2xl font-bold tracking-tight leading-none">Pactiq</span>
      </div>
      <div>
        <Kicker className="!text-seal">Private preview</Kicker>
        <h1 className="font-display text-3xl font-semibold leading-tight mt-1">Enter the password</h1>
      </div>
      {params.get("error") && <Notice>That password isn&apos;t right. Try again.</Notice>}
      <input type="hidden" name="next" value={params.get("next") ?? "/"} />
      <input
        type="password"
        name="password"
        required
        autoFocus
        autoComplete="current-password"
        aria-label="Password"
        placeholder="Password"
        className="w-full border border-ink rounded-md bg-card px-3.5 py-3 text-base outline-none focus:border-seal"
      />
      <button type="submit" className={btn("seal", "lg", "w-full")}>
        Open Pactiq
      </button>
    </form>
  );
}
