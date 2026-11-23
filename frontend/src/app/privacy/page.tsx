import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy notice · Pactiq",
  description: "What Pactiq sees, what is public on the chain, and where your check-in photos go.",
};

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy notice"
      lead="Pactiq has no accounts, no email sign-up and no advertising or analytics trackers. Two things matter most: what you put on the chain is public forever, and your check-in photos are sent to an AI model to be judged."
    >
      <h2>1. What is public on the chain</h2>
      <p>When you sign a pact or check in, this is recorded on the QIE network, where anyone can read it and nobody can delete it:</p>
      <ul>
        <li>your wallet address, and your .qie name if you sign with one;</li>
        <li>the title you give the habit, its category, length and stake;</li>
        <li>which days were verified and when, and how the pact was settled;</li>
        <li>your Proof-of-Human score, streaks and badges, which other apps can read.</li>
      </ul>
      <p>
        <strong>Do not put anything private in a habit title.</strong> Pactiq&apos;s public pages, such as the register and
        profile pages, show this same chain data.
      </p>

      <h2>2. Your check-in photos</h2>
      <ul>
        <li>Your browser shrinks the photo before sending it, which also removes embedded data such as location.</li>
        <li>
          The photo goes to Pactiq&apos;s server and from there to an AI vision model, through the 0G Compute Router, to be
          judged. That provider handles the image under its own terms.
        </li>
        <li>
          <strong>Pactiq does not keep your photos.</strong> Once the verdict is returned, the server holds no copy.
        </li>
        <li>Only a fingerprint (a hash) of the photo is written to the chain. The picture cannot be recovered from it.</li>
      </ul>
      <p>
        Because a photo leaves your device and is seen by an AI service, keep other people, documents and anything sensitive
        out of the frame.
      </p>

      <h2>3. What the server handles</h2>
      <ul>
        <li>
          <strong>IP address.</strong> Used for a short time to count requests, so that one visitor cannot flood the AI witness.
          The counters expire within 36 hours.
        </li>
        <li>
          <strong>Reminders.</strong> If you turn on reminders, your browser&apos;s push address is stored next to your wallet
          address so the server can tell you when a check-in is about to close. It is deleted when you turn notifications off
          for the site or your browser retires the address.
        </li>
        <li>
          <strong>Hosting logs.</strong> The hosting provider keeps standard request logs (address, time, page) for a limited
          period for security and debugging.
        </li>
      </ul>

      <h2>4. What stays on your device</h2>
      <p>
        Your browser stores which wallet you last connected and which reminders you have already seen, so the app can
        reconnect and avoid repeating itself. Pactiq sets no advertising or tracking cookies.
      </p>

      <h2>5. Your wallet</h2>
      <p>
        Pactiq never sees your private keys or recovery phrase. Your wallet shares your public address with the site when you
        connect, and asks you before every transaction.
      </p>

      <h2>6. Other services involved</h2>
      <ul>
        <li>The QIE network and its public servers, which carry your transactions.</li>
        <li>The AI model provider that judges photos.</li>
        <li>Your browser&apos;s push service (run by Google, Apple, Mozilla or Microsoft), if you turn on reminders.</li>
        <li>The website&apos;s hosting provider and its data store.</li>
      </ul>
      <p>Pactiq does not sell personal data.</p>

      <h2>7. Your choices</h2>
      <ul>
        <li>You can browse the register and public pages without connecting a wallet.</li>
        <li>You can sign pacts without a .qie name.</li>
        <li>You can turn reminders off in your browser&apos;s site settings at any time.</li>
        <li>
          Data on the chain cannot be erased by anyone. Depending on where you live, you may have rights over the limited data
          held off the chain, such as a stored reminder address.
        </li>
      </ul>

      <h2>8. Changes</h2>
      <p>
        This notice may change as Pactiq does. The date at the top shows the latest version. The rules for staking are in the{" "}
        <Link href="/terms">terms of use</Link>.
      </p>
    </LegalPage>
  );
}
