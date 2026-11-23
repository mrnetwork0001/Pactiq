"use client";

import React from "react";
import type { Address } from "viem";
import { useQieId } from "@/hooks/useQie";
import { QieIdField } from "./QieIdField";
import { Button, Sheet } from "./ui";

/**
 * Lets a wallet show its .qie name without signing a pact first. QIE can only tell us a wallet's
 * name by itself when a primary name is set; otherwise the user types it once and we check it.
 */
export function NameSheet({ open, address, onClose }: { open: boolean; address: Address | null; onClose: () => void }) {
  if (!open || !address) return null;
  return <NameForm address={address} onClose={onClose} />;
}

function NameForm({ address, onClose }: { address: Address; onClose: () => void }) {
  const id = useQieId(address, "");
  return (
    <Sheet kicker="Your name" title="Show your .qie name" subtitle="Type the QIE ID this wallet holds. Once it checks out, Pactiq shows it in place of your address." onClose={onClose}>
      <div className="space-y-5">
        <QieIdField id={id} />
        <Button variant="seal" size="lg" className="w-full" disabled={id.state !== "verified"} onClick={onClose}>
          {id.state === "verified" ? `Use ${id.name}` : "Enter a name you hold"}
        </Button>
      </div>
    </Sheet>
  );
}
