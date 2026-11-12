import { describe, it, expect } from "vitest";
import { checkoutPriceFor } from "./payments-env";

describe("one free trial per account", () => {
  it("first-time subscribers get the 7-day trial price", () => expect(checkoutPriceFor(0)).toBe("pro_monthly"));
  it("returning subscribers get the no-trial price", () => expect(checkoutPriceFor(1)).toBe("pro_monthly_no_trial"));
});
