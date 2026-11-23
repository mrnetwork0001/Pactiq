"use client";

import React from "react";
import { BadgeCheck, CircleAlert, ExternalLink, Loader2 } from "lucide-react";
import { QIE_ID_URL } from "@/lib/chain";
import type { useQieId } from "@/hooks/useQie";

/** The signature line of a pact: a .qie name the wallet provably holds, or none. */
export function QieIdField({ id, compact = false }: { id: ReturnType<typeof useQieId>; compact?: boolean }) {
  const { value, setValue, name, primary, state, retry } = id;
  return (
    <div>
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          placeholder={state === "disabled" ? "Names are off on this network" : "yourname.qie"}
          value={value}
          disabled={state === "disabled"}
          onChange={(e) => setValue(e.target.value)}
          className="field num text-sm flex-1 min-w-0"
          aria-describedby="qie-id-status"
        />
        {primary && value !== primary && (
          <button type="button" onClick={() => setValue(primary)} className="choice !py-1 text-xs shrink-0">
            Use {primary}
          </button>
        )}
        {value && (
          <button type="button" onClick={() => setValue("")} className="choice !py-1 text-xs shrink-0">
            None
          </button>
        )}
      </div>
      <p id="qie-id-status" className={`text-xs mt-2 flex items-start gap-1.5 ${compact ? "" : "leading-relaxed"}`}>
        {state === "verified" && (
          <span className="text-kept inline-flex items-center gap-1.5">
            <BadgeCheck className="w-4 h-4 shrink-0" /> <strong>{name}</strong> is held by this wallet, checked against QIE&apos;s name service.
          </span>
        )}
        {state === "wallet" && <span className="text-ink-3">Connect your wallet and we&apos;ll check that it holds {name}.</span>}
        {state === "error" && (
          <span className="text-ink-2">
            Couldn&apos;t reach QIE&apos;s name service to check {name}.{" "}
            <button type="button" onClick={retry} className="text-quill underline cursor-pointer">
              Try again
            </button>
            , or sign without a name.
          </span>
        )}
        {state === "checking" && (
          <span className="text-ink-3 inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> Looking up {name} on QIE…
          </span>
        )}
        {state === "unowned" && (
          <span className="text-seal inline-flex items-start gap-1.5">
            <CircleAlert className="w-4 h-4 shrink-0" />
            <span>
              This wallet doesn&apos;t hold <strong>{name}</strong>, so it can&apos;t go on the record. Pick a name you own, or sign without one.
            </span>
          </span>
        )}
        {state === "empty" && (
          <span className="text-ink-3">
            Signing without a name: the register shows your address.{" "}
            <a href={QIE_ID_URL} target="_blank" rel="noreferrer" className="text-quill underline inline-flex items-center gap-1">
              Get a QIE ID <ExternalLink className="w-3 h-3" />
            </a>
          </span>
        )}
        {state === "disabled" && <span className="text-ink-3">This deployment has no QIE ID checker, so pacts are signed by address.</span>}
      </p>
    </div>
  );
}
