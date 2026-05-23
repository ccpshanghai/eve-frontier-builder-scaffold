import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SupplyTerminal } from "../SupplyTerminal";
import type {
  SupplyTerminalChainEnv,
  SupplyTerminalChainSnapshot,
} from "../types";

const mocks = vi.hoisted(() => ({
  useConnection: vi.fn(),
  useCurrentAccount: vi.fn(),
  useDAppKit: vi.fn(),
  useSupplyTerminalStorage: vi.fn(),
  signAndExecuteTransaction: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@evefrontier/dapp-kit", () => ({
  useConnection: mocks.useConnection,
}));

vi.mock("@mysten/dapp-kit-react", () => ({
  useCurrentAccount: mocks.useCurrentAccount,
  useDAppKit: mocks.useDAppKit,
}));

vi.mock("../storage", () => ({
  useSupplyTerminalStorage: mocks.useSupplyTerminalStorage,
}));

const env: SupplyTerminalChainEnv = {
  storageObjectId: "0xstorage",
  worldPackageId: "0xworld",
  supplyTerminalPackageId: "0xbuilder",
  supplyTerminalConfigId: "0xconfig",
  rpcUrl: "http://127.0.0.1:9000",
};

function createSnapshot(
  overrides: Partial<SupplyTerminalChainSnapshot> = {},
): SupplyTerminalChainSnapshot {
  return {
    storage: {
      id: "0xstorage",
      ownerCapId: "0xmachinecap",
      status: "ONLINE",
      extension: "0xbuilder::config::SupplyTerminalAuth",
    },
    listing: {
      enabled: true,
      productTypeId: 84210,
      productQuantity: 1,
      paymentTypeId: 77800,
      paymentQuantity: 10,
    },
    machineInventory: [{ typeId: 84210, quantity: 1 }],
    buyerInventory: [{ typeId: 77800, quantity: 10 }],
    character: {
      id: "0xcharacter",
      ownerCapId: "0xcharactercap",
    },
    ...overrides,
  };
}

function mockStorage(snapshot: SupplyTerminalChainSnapshot): void {
  mocks.useSupplyTerminalStorage.mockReturnValue({
    snapshot,
    storage: snapshot.storage,
    loading: false,
    refreshing: false,
    error: null,
    env,
    refetch: mocks.refetch,
  });
}

describe("SupplyTerminal", () => {
  beforeEach(() => {
    mocks.useConnection.mockReturnValue({ isConnected: false });
    mocks.useCurrentAccount.mockReturnValue(null);
    mocks.signAndExecuteTransaction.mockResolvedValue({
      digest: "0xdigest",
    });
    mocks.useDAppKit.mockReturnValue({
      signAndExecuteTransaction: mocks.signAndExecuteTransaction,
    });
    mocks.refetch.mockResolvedValue(undefined);
    mockStorage(
      createSnapshot({
        buyerInventory: [],
        character: null,
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders storage-backed slots and disables trade actions before wallet connection", async () => {
    render(<SupplyTerminal />);

    await waitFor(() => {
      expect(screen.getByText("SLOT 01")).toBeDefined();
    });

    expect(screen.queryByText("No assembly found")).toBeNull();
    expect(screen.getByText("SUPPLY TERMINAL")).toBeDefined();
    expect(screen.getByText("Connect wallet to trade")).toBeDefined();

    const tradeButton = screen.getByRole("button", { name: "TRADE" });
    expect(tradeButton.hasAttribute("disabled")).toBe(true);
  });

  it("submits a chain exchange transaction and refetches after connected trade", async () => {
    mocks.useConnection.mockReturnValue({ isConnected: true });
    mocks.useCurrentAccount.mockReturnValue({ address: "0xcharacter" });
    mockStorage(createSnapshot());

    render(<SupplyTerminal />);

    const tradeButton = await screen.findByRole("button", {
      name: "TRADE",
    });
    fireEvent.click(tradeButton);
    fireEvent.click(screen.getByRole("button", { name: "CONFIRM TRADE" }));

    await waitFor(() => {
      expect(mocks.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
    });
    expect(
      mocks.signAndExecuteTransaction.mock.calls[0]?.[0].transaction,
    ).toBeDefined();

    await waitFor(() => {
      expect(mocks.refetch).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/Exchange complete/)).toBeDefined();
  });
});
