import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TradeConfirmDialog } from "../TradeConfirmDialog";
import type { SupplyTerminalSlot } from "../types";

function createSlot(overrides: Partial<SupplyTerminalSlot> = {}): SupplyTerminalSlot {
    return {
        id: "slot-01",
        index: 1,
        label: "SLOT 01",
        status: "ready",
        reward: {
            name: "Carbon Weave",
            sandboxItemId: 84210,
            quantity: 1,
        },
        price: {
            name: "Feldspar Crystals",
            sandboxItemId: 77800,
            quantity: 10,
        },
        canTrade: true,
        ...overrides,
    };
}

describe("TradeConfirmDialog", () => {
    it("renders nothing when closed", () => {
        const { container } = render(
            <TradeConfirmDialog
                slot={null}
                submitting={false}
                error={null}
                onCancel={() => {}}
                onConfirm={() => {}}
            />,
        );

        expect(container.firstChild).toBeNull();
    });

    it("renders selected trade details", () => {
        render(
            <TradeConfirmDialog
                slot={createSlot()}
                submitting={false}
                error={null}
                onCancel={() => {}}
                onConfirm={() => {}}
            />,
        );

        const dialog = screen.getByRole("dialog", { name: "Confirm trade" });
        expect(dialog.getAttribute("aria-modal")).toBe("true");
        expect(screen.getAllByText("CONFIRM TRADE")).toHaveLength(2);
        expect(screen.getByText("Slot 01")).toBeDefined();
        expect(screen.getByText("READY")).toBeDefined();
        expect(screen.getByText("Carbon Weave x1")).toBeDefined();
        expect(screen.getByText("Feldspar Crystals x10")).toBeDefined();
        expect(screen.getByText("AVAILABLE")).toBeDefined();
        expect(screen.getByText("Slot 01 becomes EMPTY")).toBeDefined();
    });

    it("calls cancel and confirm handlers", () => {
        const slot = createSlot();
        const onCancel = vi.fn();
        const onConfirm = vi.fn();

        render(
            <TradeConfirmDialog
                slot={slot}
                submitting={false}
                error={null}
                onCancel={onCancel}
                onConfirm={onConfirm}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
        fireEvent.click(screen.getByRole("button", { name: "CONFIRM TRADE" }));

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(slot);
    });

    it("disables actions while submitting and shows error text", () => {
        const onCancel = vi.fn();
        const onConfirm = vi.fn();

        render(
            <TradeConfirmDialog
                slot={createSlot()}
                submitting={true}
                error="Wallet rejected transaction"
                onCancel={onCancel}
                onConfirm={onConfirm}
            />,
        );

        const cancel = screen.getByRole("button", { name: "CANCEL" });
        const confirm = screen.getByRole("button", { name: "SUBMITTING" });

        expect(cancel.hasAttribute("disabled")).toBe(true);
        expect(confirm.hasAttribute("disabled")).toBe(true);
        expect(screen.getByText("Wallet rejected transaction")).toBeDefined();

        fireEvent.click(cancel);
        fireEvent.click(confirm);

        expect(onCancel).not.toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("renders nothing when a selected slot lacks reward or price", () => {
        const missingReward = render(
            <TradeConfirmDialog
                slot={createSlot({ reward: undefined })}
                submitting={false}
                error={null}
                onCancel={() => {}}
                onConfirm={() => {}}
            />,
        );
        expect(missingReward.container.firstChild).toBeNull();
        missingReward.unmount();

        const missingPrice = render(
            <TradeConfirmDialog
                slot={createSlot({ price: undefined })}
                submitting={false}
                error={null}
                onCancel={() => {}}
                onConfirm={() => {}}
            />,
        );
        expect(missingPrice.container.firstChild).toBeNull();
    });
});
