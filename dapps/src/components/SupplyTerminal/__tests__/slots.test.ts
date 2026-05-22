import { describe, expect, it } from "vitest";
import { buildSupplyTerminalSlots } from "../slots";

describe("buildSupplyTerminalSlots", () => {
    it("creates one ready slot and five empty slots when all preconditions pass", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: false,
        });

        expect(slots).toHaveLength(6);
        expect(slots[0]).toMatchObject({
            id: "slot-01",
            label: "SLOT 01",
            status: "ready",
            canTrade: true,
        });
        expect(slots[0].reward?.name).toBe("Carbon Weave");
        expect(slots[0].price?.name).toBe("Feldspar Crystals");
        expect(slots.slice(1).every((slot) => slot.status === "empty")).toBe(true);
        expect(slots.slice(1).every((slot) => slot.canTrade === false)).toBe(true);
    });

    it("returns copies of configured reward and price items", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: false,
        });
        const rebuiltSlots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: false,
        });

        expect(slots[0].reward).toEqual(rebuiltSlots[0].reward);
        expect(slots[0].price).toEqual(rebuiltSlots[0].price);
        expect(slots[0].reward).not.toBe(rebuiltSlots[0].reward);
        expect(slots[0].price).not.toBe(rebuiltSlots[0].price);
    });

    it("disables Slot 01 when payment is unavailable", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: false,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: false,
        });

        expect(slots[0]).toMatchObject({
            status: "insufficient_payment",
            canTrade: false,
            disabledReason: "Requires Feldspar Crystals x10",
        });
    });

    it("disables Slot 01 when machine stock is unavailable", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: false,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: false,
        });

        expect(slots[0]).toMatchObject({
            status: "out_of_stock",
            canTrade: false,
            disabledReason: "Carbon Weave unavailable",
        });
    });

    it("disables Slot 01 when the extension is not authorized", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: false,
            submitting: false,
            sold: false,
        });

        expect(slots[0]).toMatchObject({
            status: "extension_not_authorized",
            canTrade: false,
            disabledReason: "Extension authorization required",
        });
    });

    it("renders Slot 01 as sold after it has been purchased in the current session", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: true,
        });

        expect(slots[0]).toMatchObject({
            id: "slot-01",
            label: "SLOT 01",
            status: "sold",
            canTrade: false,
        });
        expect(slots[0].reward).toBeUndefined();
        expect(slots[0].price).toBeUndefined();
    });
});
