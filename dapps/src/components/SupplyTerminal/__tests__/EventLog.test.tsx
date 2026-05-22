import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventLog } from "../EventLog";
import { ExchangeEvent } from "../types";

describe("EventLog", () => {
    it("renders nothing when no events", () => {
        const { container } = render(<EventLog events={[]} />);
        expect(container.innerHTML).toBe("");
    });

    it("renders local event", () => {
        const events: ExchangeEvent[] = [
            { type: "local", message: "Product selected: Carbon Weave", timestamp: 1000 },
        ];
        render(<EventLog events={events} />);
        expect(screen.getByText(/Product selected: Carbon Weave/)).toBeDefined();
    });

    it("renders chain event with digest", () => {
        const events: ExchangeEvent[] = [
            { type: "chain", message: "Exchange completed", digest: "0xabcdef1234567890", timestamp: 2000 },
        ];
        render(<EventLog events={events} />);
        expect(screen.getByText(/Exchange completed/)).toBeDefined();
        expect(screen.getByText(/0xabcdef12/)).toBeDefined();
    });

    it("renders multiple events", () => {
        const events: ExchangeEvent[] = [
            { type: "local", message: "Payment staged", timestamp: 1000 },
            { type: "chain", message: "Payment accepted", timestamp: 2000 },
            { type: "chain", message: "Dispensed: Carbon Weave x1", timestamp: 3000 },
        ];
        render(<EventLog events={events} />);
        expect(screen.getByText(/Payment staged/)).toBeDefined();
        expect(screen.getByText(/Payment accepted/)).toBeDefined();
        expect(screen.getByText(/Dispensed/)).toBeDefined();
    });
});
