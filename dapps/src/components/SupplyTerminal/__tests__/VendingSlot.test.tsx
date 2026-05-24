import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VendingSlot } from "../VendingSlot";
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
        machineStockQuantity: 1,
        ...overrides,
    };
}

describe("VendingSlot", () => {
    it("renders a ready slot with reward, price, and enabled trade action", () => {
        const slot = createSlot();
        const onTrade = vi.fn();

        render(<VendingSlot slot={slot} onTrade={onTrade} />);

        expect(screen.getByText("SLOT 01")).toBeDefined();
        expect(screen.getByText("READY")).toBeDefined();
        expect(screen.getByText("Carbon Weave")).toBeDefined();
        expect(screen.getByText("Stock: 1 / 1")).toBeDefined();
        expect(screen.getByText("Price: Feldspar Crystals x10")).toBeDefined();

        const button = screen.getByRole("button", { name: "TRADE" });
        expect(button.hasAttribute("disabled")).toBe(false);
    });

    it("calls onTrade with the slot when the ready action is clicked", () => {
        const slot = createSlot();
        const onTrade = vi.fn();

        render(<VendingSlot slot={slot} onTrade={onTrade} />);
        fireEvent.click(screen.getByRole("button", { name: "TRADE" }));

        expect(onTrade).toHaveBeenCalledTimes(1);
        expect(onTrade).toHaveBeenCalledWith(slot);
    });

    it("renders an empty slot with disabled empty action", () => {
        const onTrade = vi.fn();
        const slot = createSlot({
            status: "empty",
            reward: undefined,
            price: undefined,
            canTrade: false,
        });

        render(<VendingSlot slot={slot} onTrade={onTrade} />);

        expect(screen.getAllByText("EMPTY").length).toBeGreaterThan(0);
        expect(screen.getByText("No Item")).toBeDefined();
        expect(screen.getAllByText("--").length).toBeGreaterThan(0);

        const button = screen.getByRole("button", { name: "Empty" });
        expect(button.hasAttribute("disabled")).toBe(true);
        fireEvent.click(button);
        expect(onTrade).not.toHaveBeenCalled();
    });

    it("renders a sold slot as empty", () => {
        const slot = createSlot({
            status: "sold",
            reward: undefined,
            price: undefined,
            canTrade: false,
        });

        render(<VendingSlot slot={slot} onTrade={() => {}} />);

        expect(screen.getAllByText("EMPTY").length).toBeGreaterThan(0);
        expect(
            screen.getByRole("button", { name: "Empty" }).hasAttribute("disabled"),
        ).toBe(true);
    });

    it("shows disabled reason on button and prevents trade for blocked active slots", () => {
        const onTrade = vi.fn();
        const slot = createSlot({
            status: "insufficient_payment",
            canTrade: false,
            disabledReason: "Requires Feldspar Crystals x10",
        });

        render(<VendingSlot slot={slot} onTrade={onTrade} />);

        expect(screen.getByText("NO PAYMENT")).toBeDefined();

        const button = screen.getByRole("button", { name: "Insufficient Payment" });
        expect(button.hasAttribute("disabled")).toBe(true);
        fireEvent.click(button);
        expect(onTrade).not.toHaveBeenCalled();
    });

    it.each([
        ["extension_not_authorized", "NO AUTH"],
        ["out_of_stock", "NO STOCK"],
        ["submitting", "SUBMITTING"],
    ] as const)("maps %s status to %s", (status, label) => {
        render(
            <VendingSlot
                slot={createSlot({ status, canTrade: false })}
                onTrade={() => {}}
            />,
        );

        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
});
