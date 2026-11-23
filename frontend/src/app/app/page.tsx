import type { Metadata } from "next";
import App from "@/components/App";

export const metadata: Metadata = {
  title: "Your pacts · Pactiq",
  description: "Check in, settle up, join squads and see the register of verified humans on QIE.",
};

export default function AppPage() {
  return <App />;
}
