import type { Metadata } from "next";
import Launch from "@/components/Launch";

export const metadata: Metadata = {
  title: "The First Ten · Pactiq launch campaign",
  description: "200 QIE for the first ten people to keep a three-day streak on Pactiq.",
};

export default function LaunchPage() {
  return <Launch />;
}
