import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VendingGrid } from "../VendingGrid";
import { buildSupplyTerminalSlots } from "../slots";
import type { SupplyTerminalSlot } from "../types";

function createReadySlots() {
    return buildSupplyTerminalSlots({
        paymentAvailable: true,
        machineStockAvailable: true,
        listingEnabled: true,
        extensionAuthorized: true,
        submitting: false,
        sold: false,
    });
}

describe("VendingGrid", () => {
    it("renders sale slot panel copy and all six vending slots", () => {
        const slots = createReadySlots();

        render(<VendingGrid slots={slots} onTrade={() => {}} />);

        expect(screen.getByText("SALE SLOTS")).toBeDefined();
        expect(
            screen.getByText(
                "Payment check uses player StorageUnit-owned inventory. Empty slots are future vending bays.",
            ),
        ).toBeDefined();
        expect(screen.getByText("SLOT 01")).toBeDefined();
        expect(screen.getByText("SLOT 06")).toBeDefined();
        expect(screen.getByText("Carbon Weave")).toBeDefined();
        expect(screen.getAllByText("No Item")).toHaveLength(5);
    });

    it("displays ready and empty counts", () => {
        render(<VendingGrid slots={createReadySlots()} onTrade={() => {}} />);

        expect(screen.getByText("1 READY")).toBeDefined();
        expect(screen.getByText("5 EMPTY")).toBeDefined();
    });

    it("routes trade clicks to the selected slot", () => {
        const slots = createReadySlots();
        const onTrade = vi.fn();

        render(<VendingGrid slots={slots} onTrade={onTrade} />);
        fireEvent.click(screen.getByRole("button", { name: "TRADE" }));

        expect(onTrade).toHaveBeenCalledTimes(1);
        expect(onTrade).toHaveBeenCalledWith(slots[0]);
    });

    it("counts sold slots as empty", () => {
        const slots: SupplyTerminalSlot[] = createReadySlots().map((slot) =>
            slot.index === 1
                ? {
                      ...slot,
                      status: "sold",
                      reward: undefined,
                      price: undefined,
                      canTrade: false,
                  }
                : slot,
        );

        render(<VendingGrid slots={slots} onTrade={() => {}} />);

        expect(screen.getByText("0 READY")).toBeDefined();
        expect(screen.getByText("6 EMPTY")).toBeDefined();
    });

    it("does not route disabled slot clicks through VendingSlot", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: false,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: false,
        });
        const onTrade = vi.fn();

        render(<VendingGrid slots={slots} onTrade={onTrade} />);
        fireEvent.click(screen.getByRole("button", { name: "TRADE" }));

        expect(onTrade).not.toHaveBeenCalled();
    });
});
