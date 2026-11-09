import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, CONTACT } from "@/components/LegalPage";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Song Analyzer" },
      { name: "description", content: "Song Analyzer Pro comes with a 30-day money-back guarantee." },
      { property: "og:title", content: "Refund Policy — Song Analyzer" },
      { property: "og:description", content: "30-day money-back guarantee on Song Analyzer Pro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="REFUND POLICY">
      <p>We offer a 30-day money-back guarantee. If you're not satisfied with Song Analyzer Pro, you can request a full refund within 30 days of your order date.</p>
      <p>Refunds are processed by our payment provider, Paddle. To request one, visit <a href="https://paddle.net" target="_blank" rel="noreferrer">paddle.net</a> and look up your order, or email us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      <p>You can also cancel any time from the Go Pro page using Manage Billing. Pro stays active until the end of the period you've paid for. See also <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noreferrer">Paddle's refund policy</a>.</p>
    </LegalPage>
  ),
});
