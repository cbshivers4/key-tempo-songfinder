import { describe, it, expect } from "vitest";
import { checkoutPriceFor, hasUnlimitedUse, planFor, type SubRow } from "./payments-env";

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
const row = (over: Partial<SubRow>): SubRow => ({ status: "active", current_period_end: future, cancel_at_period_end: false, ...over });

describe("one free trial per account", () => {
  it("first-time subscribers get the 7-day trial price", () => expect(checkoutPriceFor(0)).toBe("pro_monthly"));
  it("returning subscribers get the no-trial price", () => expect(checkoutPriceFor(1)).toBe("pro_monthly_no_trial"));
});

describe("free access for named accounts", () => {
  it("a free-access account with no subscription gets Pro", () => expect(planFor(null, true)).toBe("free_grant"));
  it("a free-access account keeps Pro after its subscription ends", () => expect(planFor(row({ status: "canceled", current_period_end: past }), true)).toBe("free_grant"));
  it("a free-access account is never asked to pay", () => expect(hasUnlimitedUse(planFor(null, true))).toBe(true));
  it("a paid account is not treated as free access", () => expect(planFor(row({}), false)).toBe("pro"));
});

describe("plan for signed-in accounts", () => {
  it("no subscription means the free 3-uses-a-day plan", () => expect(planFor(null, false)).toBe("free"));
  it("a running trial reads as a trial", () => expect(planFor(row({ status: "trialing" }), false)).toBe("trial"));
  it("canceling keeps Pro until the paid period ends", () => expect(planFor(row({ status: "active", cancel_at_period_end: true }), false)).toBe("ending"));
  it("a canceled subscription keeps Pro until the paid period ends", () => expect(planFor(row({ status: "canceled" }), false)).toBe("ending"));
  it("a failed payment keeps Pro but asks for a new card", () => expect(planFor(row({ status: "past_due" }), false)).toBe("past_due"));
  it("an expired subscription means paying again", () => expect(planFor(row({ current_period_end: past }), false)).toBe("returning"));
  it("only trials and paid states give unlimited use", () => {
    expect(hasUnlimitedUse(planFor(null, false))).toBe(false);
    expect(hasUnlimitedUse(planFor(row({ current_period_end: past }), false))).toBe(false);
    expect(hasUnlimitedUse(planFor(row({ status: "trialing" }), false))).toBe(true);
    expect(hasUnlimitedUse(planFor(row({ status: "past_due" }), false))).toBe(true);
  });
});
