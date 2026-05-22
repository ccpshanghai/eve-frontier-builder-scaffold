import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventLog } from "../EventLog";
import { ExchangeEvent } from "../types";

describe("EventLog", () => {
    it("renders nothing when no events", () => {
        const { container } = render(<EventLog events={[]} />);
        expect(container.innerHTML).toBe("");
    });

    it("renders bottom terminal event log with legend and truncated digest", () => {
        const events: ExchangeEvent[] = [
            { type: "local", message: "Terminal inventory synchronized", timestamp: 1000 },
            { type: "chain", message: "Exchange completed", digest: "0xabcdef1234567890", timestamp: 2000 },
        ];

        const { container } = render(<EventLog events={events} />);

        const section = container.querySelector(".st-panel.st-event-log");
        expect(section).not.toBeNull();
        expect(section?.querySelector(".st-panel__head")).not.toBeNull();
        expect(section?.querySelector(".st-event-log__body")).not.toBeNull();
        expect(screen.getByText("EVENT LOG")).toBeDefined();
        expect(screen.getByText("Full-width bottom terminal panel.")).toBeDefined();
        expect(screen.getByText("LOCAL")).toBeDefined();
        expect(screen.getByText("CHAIN")).toBeDefined();
        expect(screen.getByText("> Terminal inventory synchronized")).toBeDefined();
        expect(screen.getByText(/> Exchange completed/)).toBeDefined();
        expect(screen.getByText(/0xabcdef12\.\.\./)).toBeDefined();

        const lines = container.querySelectorAll(".st-event-log__line");
        expect(lines).toHaveLength(2);
        expect(lines[0].classList.contains("st-event-log__line--local")).toBe(true);
        expect(lines[1].classList.contains("st-event-log__line--chain")).toBe(true);
    });

    it("renders multiple events", () => {
        const events: ExchangeEvent[] = [
            { type: "local", message: "Payment staged", timestamp: 1000 },
            { type: "chain", message: "Payment accepted", timestamp: 2000 },
            { type: "chain", message: "Dispensed: Carbon Weave x1", timestamp: 3000 },
        ];
        render(<EventLog events={events} />);
        expect(screen.getByText("> Payment staged")).toBeDefined();
        expect(screen.getByText("> Payment accepted")).toBeDefined();
        expect(screen.getByText("> Dispensed: Carbon Weave x1")).toBeDefined();
    });
});
