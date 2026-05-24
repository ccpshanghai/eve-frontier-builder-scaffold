import { describe, it, expect } from "vitest";
import { SUPPLY_TERMINAL_CONFIG } from "../config";

describe("SUPPLY_TERMINAL_CONFIG", () => {
    it("has product Carbon Weave with sandbox ID 84210", () => {
        expect(SUPPLY_TERMINAL_CONFIG.product.name).toBe("Carbon Weave");
        expect(SUPPLY_TERMINAL_CONFIG.product.sandboxItemId).toBe(84210);
        expect(SUPPLY_TERMINAL_CONFIG.product.quantity).toBe(1);
    });

    it("has payment Feldspar Crystals with sandbox ID 77800", () => {
        expect(SUPPLY_TERMINAL_CONFIG.payment.name).toBe("Feldspar Crystals");
        expect(SUPPLY_TERMINAL_CONFIG.payment.sandboxItemId).toBe(77800);
        expect(SUPPLY_TERMINAL_CONFIG.payment.quantity).toBe(10);
    });
});
