import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MachinePanel } from "../MachinePanel";

describe("MachinePanel", () => {
    it("renders machine stock and revenue", () => {
        render(
            <MachinePanel
                carbonWeaveStock={20}
                feldsparCrystalsRevenue={10}
                online={true}
                extensionAuthorized={true}
            />
        );
        expect(screen.getByText(/Carbon Weave Stock: 20/)).toBeDefined();
        expect(screen.getByText(/Feldspar Crystals Revenue: 10/)).toBeDefined();
    });

    it("shows Online when online is true", () => {
        render(
            <MachinePanel
                carbonWeaveStock={0}
                feldsparCrystalsRevenue={0}
                online={true}
                extensionAuthorized={false}
            />
        );
        expect(screen.getByText("Online")).toBeDefined();
    });

    it("shows Offline when online is false", () => {
        render(
            <MachinePanel
                carbonWeaveStock={0}
                feldsparCrystalsRevenue={0}
                online={false}
                extensionAuthorized={false}
            />
        );
        expect(screen.getByText("Offline")).toBeDefined();
    });

    it("shows extension authorized badge when authorized", () => {
        render(
            <MachinePanel
                carbonWeaveStock={0}
                feldsparCrystalsRevenue={0}
                online={true}
                extensionAuthorized={true}
            />
        );
        expect(screen.getByText("Extension: Authorized")).toBeDefined();
    });

    it("shows extension not authorized badge when not authorized", () => {
        render(
            <MachinePanel
                carbonWeaveStock={0}
                feldsparCrystalsRevenue={0}
                online={true}
                extensionAuthorized={false}
            />
        );
        expect(screen.getByText("Extension: Not Authorized")).toBeDefined();
    });
});
