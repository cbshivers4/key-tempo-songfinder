import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, SELLER, CONTACT } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — Song Analyzer" },
      { name: "description", content: "What personal data Song Analyzer collects, why, and your rights." },
      { property: "og:title", content: "Privacy Notice — Song Analyzer" },
      { property: "og:description", content: "How Song Analyzer handles your data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="PRIVACY NOTICE">
      <p>{SELLER} is the data controller for personal data collected through this website: we decide why and how it is used.</p>
      <h2>What we collect and why</h2>
      <ul>
        <li><b>Account data</b> (email, login details, name if you sign in with Google) — to create and secure your account (contract).</li>
        <li><b>Library data</b> (songs you identify, favorites) — to provide the service (contract).</li>
        <li><b>Audio for identification</b> — short microphone clips are sent to our recognition provider to name the song and are not stored by us (contract). Files you analyze or vocode are processed in your browser and not uploaded.</li>
        <li><b>Usage data</b> (daily use counts, subscription status) — to apply free limits and Pro access (contract).</li>
        <li><b>Technical data</b> (IP address, device and browser info, logs) — for security and fraud prevention and to improve the service (legitimate interests).</li>
        <li><b>Support messages</b> — to answer you (legitimate interests).</li>
      </ul>
      <h2>Who we share it with</h2>
      <ul>
        <li>Service providers: hosting and database, sign-in, and song recognition (AudD).</li>
        <li>Paddle, our Merchant of Record, for the sale of the product, subscription management, payments, tax compliance and invoicing.</li>
        <li>Professional advisers (legal, accounting) where needed.</li>
        <li>Authorities where required by law.</li>
      </ul>
      <p>Some providers may process data outside your country; where they do, we rely on appropriate safeguards such as standard contractual clauses.</p>
      <h2>How long we keep it</h2>
      <p>We keep account and library data while your account is open, and delete or anonymise it when it's no longer needed or after you ask us to close your account, unless the law requires us to keep it.</p>
      <h2>Your rights</h2>
      <p>Depending on where you live, you can ask to access, correct, delete, restrict or export your data, object to processing, and withdraw consent. You can also complain to your local data protection authority. Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>; we reply within one month.</p>
      <h2>Security</h2>
      <p>We use appropriate technical and organisational measures, including encryption in transit and access controls so only you can read your library.</p>
      <h2>Cookies and local storage</h2>
      <p>We use only essential storage: to keep you signed in, and to store your library and daily use count on your device when signed out. We don't use advertising cookies. You can clear this in your browser settings.</p>
    </LegalPage>
  ),
});
