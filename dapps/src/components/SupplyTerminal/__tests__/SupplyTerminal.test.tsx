import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SupplyTerminal } from "../SupplyTerminal";

const mocks = vi.hoisted(() => ({
    getObjectWithJson: vi.fn(),
    isOwner: vi.fn(),
    useConnection: vi.fn(),
    useSmartObject: vi.fn(),
    useCurrentAccount: vi.fn(),
    useDAppKit: vi.fn(),
}));

vi.mock("@evefrontier/dapp-kit", () => ({
    getObjectWithJson: mocks.getObjectWithJson,
    isOwner: mocks.isOwner,
    useConnection: mocks.useConnection,
    useSmartObject: mocks.useSmartObject,
}));

vi.mock("@mysten/dapp-kit-react", () => ({
    useCurrentAccount: mocks.useCurrentAccount,
    useDAppKit: mocks.useDAppKit,
}));

function createStorageObjectResult() {
    return {
        data: {
            object: {
                asMoveObject: {
                    contents: {
                        type: {
                            repr: "0xworld::storage_unit::StorageUnit",
                        },
                        json: {
                            id: "0xstorage",
                            status: {
                                status: {
                                    "@variant": "ONLINE",
                                },
                            },
                            extension: "0xpackage::config::SupplyTerminalAuth",
                        },
                    },
                },
            },
        },
    };
}

describe("SupplyTerminal", () => {
    beforeEach(() => {
        vi.stubEnv("VITE_OBJECT_ID", "0xstorage");
        mocks.getObjectWithJson.mockResolvedValue(createStorageObjectResult());
        mocks.isOwner.mockReturnValue(false);
        mocks.useConnection.mockReturnValue({ isConnected: false });
        mocks.useSmartObject.mockReturnValue({
            assembly: null,
            loading: false,
            error: null,
        });
        mocks.useCurrentAccount.mockReturnValue(null);
        mocks.useDAppKit.mockReturnValue({
            signAndExecuteTransaction: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it("renders storage-backed slots and disables trade actions before wallet connection", async () => {
        render(<SupplyTerminal />);

        await waitFor(() => {
            expect(screen.getByText("SLOT 01")).toBeDefined();
        });

        expect(mocks.getObjectWithJson).toHaveBeenCalledWith("0xstorage");
        expect(screen.queryByText("No assembly found")).toBeNull();
        expect(screen.getByText("SUPPLY TERMINAL")).toBeDefined();
        expect(screen.getByText("Connect wallet to trade")).toBeDefined();

        const tradeButton = screen.getByRole("button", { name: "TRADE" });
        expect(tradeButton.hasAttribute("disabled")).toBe(true);
    });
});
