import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import ProfileView from "./ProfileView";

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const image = `/api/card?address=${encodeURIComponent(address)}`;
  return {
    title: `Proof-of-Human profile · Pactiq`,
    description: "AI-verified daily discipline, staked on QIE. Score, streaks and soulbound badges.",
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
      <ProfileView />
      </Suspense>
    </>
  );
}
