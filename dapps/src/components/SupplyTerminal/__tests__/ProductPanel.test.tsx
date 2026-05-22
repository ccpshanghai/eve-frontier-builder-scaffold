import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductPanel } from "../ProductPanel";

describe("ProductPanel", () => {
    it("renders product name and price", () => {
        render(
            <ProductPanel stock={20} onSelect={() => {}} selected={false} disabled={false} />
        );
        expect(screen.getByText("Carbon Weave")).toBeDefined();
        expect(screen.getByText(/Feldspar Crystals x10/)).toBeDefined();
        expect(screen.getByText("Stock: 20")).toBeDefined();
    });

    it("shows 'Selected' when selected is true", () => {
        render(
            <ProductPanel stock={20} onSelect={() => {}} selected={true} disabled={false} />
        );
        expect(screen.getByText("Selected")).toBeDefined();
    });

    it("shows 'Select' when not selected", () => {
        render(
            <ProductPanel stock={20} onSelect={() => {}} selected={false} disabled={false} />
        );
        expect(screen.getByText("Select")).toBeDefined();
    });

    it("disables button when disabled prop is true", () => {
        render(
            <ProductPanel stock={20} onSelect={() => {}} selected={false} disabled={true} />
        );
        const button = screen.getByRole("button", { name: "Select" });
        expect(button.hasAttribute("disabled")).toBe(true);
    });
});
