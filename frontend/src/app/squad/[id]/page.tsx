import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import SquadInvite from "./SquadInvite";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const image = `/api/card?squad=${encodeURIComponent(id)}`;
  return {
    title: `Join squad #${id} on Pactiq`,
    description: "Commit together. Missed days pay the finishers. AI-verified daily check-ins on QIE.",
    openGraph: { images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

/** Marks the route as request-time so generateMetadata can read params (Cache Components). */
async function RequestTime() {
  await connection();
  return null;
}

export default function Page() {
  return (
    <>
      <Suspense fallback={null}>
        <RequestTime />
      </Suspense>
      <Suspense fallback={<div className="min-h-screen" />}>
      <SquadInvite />
      </Suspense>
    </>
  );
}
