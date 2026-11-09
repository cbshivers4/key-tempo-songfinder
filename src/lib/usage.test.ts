import { describe, it, expect, vi } from "vitest";
vi.mock("@/utils/payments.functions", () => ({ consumeUse: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { FREE_USES_PER_DAY, nextLocalCount } from "./usage";

describe("free daily uses", () => {
  it("allows 3 per day", () => expect(FREE_USES_PER_DAY).toBe(3));
  it("blocks the 4th use on the same day", () => {
    expect(nextLocalCount({ day: "2026-11-09", uses: 3 }, "2026-11-09").allowed).toBe(false);
  });
  it("resets on a new day", () => {
    expect(nextLocalCount({ day: "2026-11-08", uses: 3 }, "2026-11-09")).toEqual({ allowed: true, uses: 1 });
  });
});
