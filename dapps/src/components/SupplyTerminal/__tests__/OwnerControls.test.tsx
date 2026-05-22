import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OwnerControls } from "../OwnerControls";

describe("OwnerControls", () => {
    it("renders nothing when isOwner is false", () => {
        const { container } = render(
            <OwnerControls
                isOwner={false}
                extensionAuthorized={true}
                onAuthorize={() => {}}
                isAuthorizing={false}
                onConfigure={() => {}}
            />
        );
        expect(container.innerHTML).toBe("");
    });

    it("shows authorize banner when owner and not authorized", () => {
        render(
            <OwnerControls
                isOwner={true}
                extensionAuthorized={false}
                onAuthorize={() => {}}
                isAuthorizing={false}
                onConfigure={() => {}}
            />
        );
        expect(screen.getByText(/Extension not authorized/)).toBeDefined();
        expect(screen.getByText("Authorize Extension")).toBeDefined();
    });

    it("does not show authorize banner when extension is authorized", () => {
        render(
            <OwnerControls
                isOwner={true}
                extensionAuthorized={true}
                onAuthorize={() => {}}
                isAuthorizing={false}
                onConfigure={() => {}}
            />
        );
        expect(screen.queryByText(/Extension not authorized/)).toBeNull();
    });

    it("shows authorizing text when isAuthorizing is true", () => {
        render(
            <OwnerControls
                isOwner={true}
                extensionAuthorized={false}
                onAuthorize={() => {}}
                isAuthorizing={true}
                onConfigure={() => {}}
            />
        );
        expect(screen.getByText("Authorizing...")).toBeDefined();
    });

    it("shows Configure button when owner", () => {
        render(
            <OwnerControls
                isOwner={true}
                extensionAuthorized={true}
                onAuthorize={() => {}}
                isAuthorizing={false}
                onConfigure={() => {}}
            />
        );
        expect(screen.getByText("Configure")).toBeDefined();
    });

    it("does not show Configure button when not owner", () => {
        const { container } = render(
            <OwnerControls
                isOwner={false}
                extensionAuthorized={true}
                onAuthorize={() => {}}
                isAuthorizing={false}
                onConfigure={() => {}}
            />
        );
        expect(container.innerHTML).toBe("");
    });
});
