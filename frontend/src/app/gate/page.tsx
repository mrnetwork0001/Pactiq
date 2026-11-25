import type { Metadata } from "next";
import { Suspense } from "react";
import { GateForm } from "@/components/GateForm";

export const metadata: Metadata = { title: "Private preview · Pactiq", robots: { index: false } };

export default function Gate() {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <Suspense>
        <GateForm />
      </Suspense>
    </main>
  );
}
