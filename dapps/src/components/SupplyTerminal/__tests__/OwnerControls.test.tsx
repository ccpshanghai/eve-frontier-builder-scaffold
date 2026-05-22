import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

    it("shows compact authorize banner when owner and not authorized", () => {
        let authorizeCalls = 0;

        render(
            <OwnerControls
                isOwner={true}
                extensionAuthorized={false}
                onAuthorize={() => {
                    authorizeCalls += 1;
                }}
                isAuthorizing={false}
                onConfigure={() => {}}
            />
        );

        const banner = screen.getByText("EXTENSION NOT AUTHORIZED").closest(".st-auth-banner");
        expect(banner).toBeDefined();
        expect(banner?.className).toBe("st-auth-banner");

        const copy = banner?.querySelector(".st-auth-banner__copy");
        expect(copy).not.toBeNull();

        const title = screen.getByText("EXTENSION NOT AUTHORIZED");
        expect(title.className).toBe("st-auth-banner__title");

        const detail = screen.getByText("Owner action required before terminal item movement.");
        expect(detail.className).toBe("st-auth-banner__detail");

        const pulse = banner?.querySelector(".st-pulse");
        expect(pulse).not.toBeNull();
        expect(pulse?.className).toBe("st-pulse");

        const button = screen.getByRole("button", { name: "AUTHORIZE" });
        expect(button.className).toBe("st-button");
        expect(button).toHaveProperty("disabled", false);

        fireEvent.click(button);
        expect(authorizeCalls).toBe(1);
    });

    it("disables authorize action while authorizing", () => {
        let authorizeCalls = 0;

        render(
            <OwnerControls
                isOwner={true}
                extensionAuthorized={false}
                onAuthorize={() => {
                    authorizeCalls += 1;
                }}
                isAuthorizing={true}
                onConfigure={() => {}}
            />
        );

        const button = screen.getByRole("button", { name: "AUTHORIZING" });
        expect(button).toHaveProperty("disabled", true);

        fireEvent.click(button);
        expect(authorizeCalls).toBe(0);
    });

    it("shows compact configured banner when owner and authorized", () => {
        let configureCalls = 0;

        render(
            <OwnerControls
                isOwner={true}
                extensionAuthorized={true}
                onAuthorize={() => {}}
                isAuthorizing={false}
                onConfigure={() => {
                    configureCalls += 1;
                }}
            />
        );

        const banner = screen.getByText("EXTENSION AUTHORIZED").closest(".st-auth-banner");
        expect(banner).toBeDefined();
        expect(banner?.className).toBe("st-auth-banner st-auth-banner--ok");

        const copy = banner?.querySelector(".st-auth-banner__copy");
        expect(copy).not.toBeNull();

        const title = screen.getByText("EXTENSION AUTHORIZED");
        expect(title.className).toBe("st-auth-banner__title");

        const detail = screen.getByText("Terminal item movement is enabled.");
        expect(detail.className).toBe("st-auth-banner__detail");

        const pulse = banner?.querySelector(".st-pulse");
        expect(pulse).not.toBeNull();
        expect(pulse?.className).toBe("st-pulse st-pulse--ok");

        const button = screen.getByRole("button", { name: "CONFIGURE" });
        expect(button.className).toBe("st-button st-button--secondary");

        fireEvent.click(button);
        expect(configureCalls).toBe(1);
    });
});
