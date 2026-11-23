import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of use · Pactiq",
  description: "What you agree to when you stake on a habit with Pactiq, in plain words.",
};

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      lead="Pactiq lets you lock your own money behind a daily habit. If you miss days, you lose the money staked on those days. That is the product working as designed. Read this page before you sign a pact."
    >
      <h2>1. What Pactiq is</h2>
      <p>
        Pactiq is a website and a set of smart contracts on the QIE network. You sign a pact: a habit, a number of days, and a
        stake for each day, in QIE or QUSDC. The whole stake is locked in the PactiqVault contract when you sign. Each day you
        check in with a photo. Each verified day is refunded when the pact is settled.
      </p>

      <h2>2. You can lose money</h2>
      <ul>
        <li>
          <strong>Missed days are forfeited.</strong> A day counts as missed if no verified check-in is recorded before its
          window closes (24 hours plus a 12-hour grace period). The stake for that day does not come back.
        </li>
        <li>
          <strong>Where forfeited money goes.</strong> On a solo pact, 95% goes to the bonus pool that pays people who finish
          and 5% is a protocol fee, unless you chose a charity when you signed, in which case the full amount goes to that
          charity. In a squad, it is shared between the members who finished. The pact form shows the split before you sign.
        </li>
        <li>
          <strong>A pact cannot be cancelled or edited</strong> once it is signed. There is no early withdrawal.
        </li>
        <li>
          <strong>The bonus is not guaranteed.</strong> Finishing every day can earn up to 15% on top of your stake, paid from
          the bonus pool in the order pacts are settled. If the pool is empty you get your stake back and no bonus. The amount
          shown in the app is an estimate at today&apos;s pool size.
        </li>
        <li>
          <strong>Prices move.</strong> QIE can rise or fall against your own currency while it is locked. A pact set in
          dollars is converted to QIE once, when you sign.
        </li>
      </ul>

      <h2>3. The AI witness can be wrong</h2>
      <p>
        Check-in photos are judged by an AI vision model. It checks that the day&apos;s four-digit code is readable, that the
        scene matches your habit, and that the picture is a real photo. It can reject a genuine photo or accept a false one.
        You get five attempts for each day. If a genuine photo is rejected, take a clearer one with the code in view. Pactiq
        cannot override the contract and add a check-in for you after the window closes.
      </p>
      <p>
        Do not try to deceive the witness with edited, generated, reused or someone else&apos;s photos. Reputation scores and
        badges earned that way are worthless to the apps that rely on them, and sponsors may exclude you from their challenges.
      </p>

      <h2>4. Your wallet, your responsibility</h2>
      <ul>
        <li>Pactiq never holds your keys. Every action is a transaction you sign in your own wallet.</li>
        <li>Transactions on the QIE network are final. Nobody, including Pactiq, can reverse one.</li>
        <li>You pay the network fee for each transaction.</li>
        <li>If you lose access to your wallet, you lose access to the pacts signed with it.</li>
      </ul>

      <h2>5. What the operator can and cannot do</h2>
      <p>The contract has an owner account. It can:</p>
      <ul>
        <li>pause the signing of new pacts and squads (check-ins and settlement keep working while paused);</li>
        <li>choose which currencies can be staked and their minimum stake, for new pacts only;</li>
        <li>replace the key the AI witness signs with, and the price feed used for dollar pacts;</li>
        <li>add or remove charities, and withdraw the 5% protocol fees.</li>
      </ul>
      <p>
        It cannot take money staked in a pact, change the terms of a pact after it is signed, or stop you settling a pact. The
        contract cannot be upgraded. Its source code and address are public.
      </p>

      <h2>6. Risks you accept</h2>
      <ul>
        <li>
          <strong>Software risk.</strong> The contracts are tested but have not been through an independent security audit.
          A bug could cause loss of funds.
        </li>
        <li>
          <strong>Dependencies.</strong> Pactiq relies on the QIE network, the QIE Oracle, QUSDC, QIEDEX, QIE&apos;s name
          service and an AI model provider. If one of them fails or changes, parts of Pactiq may stop working. If the witness
          is unavailable for a whole check-in window, that day can be lost.
        </li>
        <li>
          <strong>Availability.</strong> The website is provided as it is, with no promise that it will always be online. The
          contract can also be used directly, without this website.
        </li>
      </ul>
      <p>Only stake an amount you can afford to lose.</p>

      <h2>7. Who may use Pactiq</h2>
      <p>
        You must be an adult where you live, and using Pactiq must be legal there. Rules about staking money on an outcome
        differ between countries, and it is your responsibility to know yours. You are also responsible for any tax on what you
        receive.
      </p>

      <h2>8. Not advice</h2>
      <p>
        Nothing on Pactiq is financial, legal, medical or fitness advice. Choose habits that are safe for you. Do not put
        yourself at risk to make a check-in.
      </p>

      <h2>9. Liability</h2>
      <p>
        To the extent the law allows, Pactiq and the people who build it are not liable for losses from using it, including
        forfeited stakes, rejected check-ins, missed reminders, software faults, or failures of the services it depends on.
        Nothing here limits rights that the law says cannot be limited.
      </p>

      <h2>10. Changes</h2>
      <p>
        These terms may change. The date at the top shows the latest version. Changes do not alter the rules of a pact that is
        already signed, because those rules are fixed in the contract. How Pactiq handles your data is described in the{" "}
        <Link href="/privacy">privacy notice</Link>.
      </p>
    </LegalPage>
  );
}
