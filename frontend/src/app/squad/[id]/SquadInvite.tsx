"use client";

import { useParams } from "next/navigation";
import App from "@/components/App";

export default function SquadInvite() {
  const { id } = useParams<{ id: string }>();
  const squadId = Number(id);
  return <App initialSquadId={Number.isSafeInteger(squadId) && squadId > 0 ? squadId : null} />;
}
