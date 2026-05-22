import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InventoryPanel } from "../InventoryPanel";

describe("InventoryPanel", () => {
    it("renders player inventory balances", () => {
        render(<InventoryPanel feldsparCrystals={100} carbonWeave={5} />);
        expect(screen.getByText(/Feldspar Crystals: 100/)).toBeDefined();
        expect(screen.getByText(/Carbon Weave: 5/)).toBeDefined();
    });

    it("renders zero balances", () => {
        render(<InventoryPanel feldsparCrystals={0} carbonWeave={0} />);
        expect(screen.getByText(/Feldspar Crystals: 0/)).toBeDefined();
        expect(screen.getByText(/Carbon Weave: 0/)).toBeDefined();
    });
});
