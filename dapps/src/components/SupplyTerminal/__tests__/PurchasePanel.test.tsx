import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PurchasePanel } from "../PurchasePanel";

describe("PurchasePanel", () => {
    const defaultProps = {
        selected: true,
        playerFeldspar: 100,
        machineStock: 20,
        exchangeState: "payment_staged" as const,
        onStagePayment: () => {},
        onConfirmExchange: () => {},
        onCancel: () => {},
    };

    it("renders with product and payment info", () => {
        render(<PurchasePanel {...defaultProps} />);
        expect(screen.getByText(/Carbon Weave x1/)).toBeDefined();
        expect(screen.getByText(/Feldspar Crystals x10/)).toBeDefined();
    });

    it("shows Stage Payment button", () => {
        render(<PurchasePanel {...defaultProps} />);
        expect(screen.getByText("Stage Payment")).toBeDefined();
    });

    it("shows Confirm Exchange button", () => {
        render(<PurchasePanel {...defaultProps} />);
        expect(screen.getByText("Confirm Exchange")).toBeDefined();
    });

    it("shows Cancel button", () => {
        render(<PurchasePanel {...defaultProps} />);
        expect(screen.getByText("Cancel")).toBeDefined();
    });

    it("disables Stage Payment when already staged", () => {
        render(<PurchasePanel {...defaultProps} exchangeState="payment_staged" />);
        const btn = screen.getByText("Stage Payment");
        expect(btn.hasAttribute("disabled")).toBe(true);
    });

    it("enables Stage Payment when selected and enough payment", () => {
        render(
            <PurchasePanel {...defaultProps} exchangeState="selected" selected={true} playerFeldspar={100} />
        );
        const btn = screen.getByText("Stage Payment");
        expect(btn.hasAttribute("disabled")).toBe(false);
    });

    it("disables Stage Payment when playerFeldspar is insufficient", () => {
        render(
            <PurchasePanel {...defaultProps} exchangeState="selected" selected={true} playerFeldspar={5} />
        );
        const btn = screen.getByText("Stage Payment");
        expect(btn.hasAttribute("disabled")).toBe(true);
    });

    it("disables Confirm Exchange when not staged", () => {
        render(<PurchasePanel {...defaultProps} exchangeState="selected" />);
        const btn = screen.getByText("Confirm Exchange");
        expect(btn.hasAttribute("disabled")).toBe(true);
    });

    it("enables Confirm Exchange when staged and stock > 0", () => {
        render(<PurchasePanel {...defaultProps} exchangeState="payment_staged" machineStock={10} />);
        const btn = screen.getByText("Confirm Exchange");
        expect(btn.hasAttribute("disabled")).toBe(false);
    });

    it("disables Confirm Exchange when stock is 0", () => {
        render(<PurchasePanel {...defaultProps} exchangeState="payment_staged" machineStock={0} />);
        const btn = screen.getByText("Confirm Exchange");
        expect(btn.hasAttribute("disabled")).toBe(true);
    });

    it("shows submitting badge", () => {
        render(<PurchasePanel {...defaultProps} exchangeState="submitting" />);
        expect(screen.getByText("Submitting...")).toBeDefined();
    });

    it("shows completed badge", () => {
        render(<PurchasePanel {...defaultProps} exchangeState="completed" />);
        expect(screen.getByText("Completed")).toBeDefined();
    });

    it("shows failed badge", () => {
        render(<PurchasePanel {...defaultProps} exchangeState="failed" />);
        expect(screen.getByText("Failed")).toBeDefined();
    });

    it("shows no badge when idle", () => {
        render(<PurchasePanel {...defaultProps} exchangeState="idle" selected={false} />);
        expect(screen.queryByText("Selected")).toBeNull();
    });
});
