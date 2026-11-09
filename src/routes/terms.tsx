import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, SELLER, CONTACT } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Song Analyzer" },
      { name: "description", content: "The terms for using Song Analyzer's song identification, analysis and vocoder tools." },
      { property: "og:title", content: "Terms & Conditions — Song Analyzer" },
      { property: "og:description", content: "The terms for using Song Analyzer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="TERMS & CONDITIONS">
      <p>These terms are an agreement between you and {SELLER} ("we", "us"). When you use this website and its tools you are contracting with {SELLER}. By continuing to use the service you agree to these terms.</p>
      <h2>The service</h2>
      <p>{SELLER} lets you identify songs from audio, analyze key, tempo, chords and sections of uploaded audio, and transform audio with a vocoder. Free accounts get a limited number of uses per day; Pro subscribers get unlimited use.</p>
      <h2>Your account</h2>
      <p>You must be of legal age to form a contract (or have a parent's permission) and, if using the service for an organization, have authority to bind it. Keep your login details confidential and your information accurate. You are responsible for activity under your account.</p>
      <h2>Acceptable use</h2>
      <p>You must not misuse the service, including:</p>
      <ul>
        <li>using it for anything unlawful, fraudulent or for spam;</li>
        <li>uploading or processing audio you do not have the right to use, or otherwise infringing anyone's intellectual property;</li>
        <li>interfering with security, spreading malware, probing, scraping or overloading the service;</li>
        <li>reverse engineering, reselling, or getting around usage limits.</li>
      </ul>
      <h2>Your audio and outputs</h2>
      <p>You keep the rights you have in audio you upload and in recordings you create. You are responsible for having the rights to the audio you use and for how you use the results. Analysis results (keys, chords, tempo, identifications) may be inaccurate. Rights-holders can report infringing use to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>; we may restrict or close accounts that repeatedly infringe.</p>
      <h2>Our property</h2>
      <p>{SELLER} owns the service, its software, design, documentation and branding. We grant you a limited, non-exclusive, non-transferable right to use it within your plan.</p>
      <h2>Payments and subscriptions</h2>
      <p>Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns. Payment, billing, tax, cancellation and refund terms are covered by <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noreferrer">Paddle's Buyer Terms</a>. Pro includes a 7-day free trial, then renews monthly until cancelled; cancelling keeps Pro until the end of the paid period.</p>
      <h2>Service level</h2>
      <p>We do not guarantee the service will be uninterrupted or error-free. To the fullest extent permitted by law it is provided "as is" without implied warranties, and our total liability is limited to the fees you paid in the previous 12 months. Nothing limits liability for fraud, death or personal injury where the law does not allow it.</p>
      <h2>Suspension and termination</h2>
      <p>We may suspend or end your access for material breach of these terms, non-payment, security or fraud risk, or repeated or serious violations. When your account ends, your saved library may be deleted.</p>
      <h2>Contact</h2>
      <p>Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalPage>
  ),
});
