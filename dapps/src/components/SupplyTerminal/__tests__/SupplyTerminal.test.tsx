import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const storageId =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const machineOwnerCapId =
  "0x0000000000000000000000000000000000000000000000000000000000000002";
const characterId =
  "0x0000000000000000000000000000000000000000000000000000000000000003";
const characterOwnerCapId =
  "0x0000000000000000000000000000000000000000000000000000000000000004";
const sender =
  "0x0000000000000000000000000000000000000000000000000000000000000005";
const worldPackageId =
  "0x0000000000000000000000000000000000000000000000000000000000000006";
const supplyTerminalPackageId =
  "0x0000000000000000000000000000000000000000000000000000000000000007";
const supplyTerminalConfigId =
  "0x0000000000000000000000000000000000000000000000000000000000000008";

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
  storageObjectId: storageId,
  worldPackageId,
  supplyTerminalPackageId,
  supplyTerminalConfigId,
  rpcUrl: "http://127.0.0.1:9000",
};

function createSnapshot(
  overrides: Partial<SupplyTerminalChainSnapshot> = {},
): SupplyTerminalChainSnapshot {
  return {
    storage: {
      id: storageId,
      ownerCapId: machineOwnerCapId,
      status: "ONLINE",
      extension: `${supplyTerminalPackageId}::config::SupplyTerminalAuth`,
    },
    listings: [
      {
        enabled: true,
        productTypeId: 84210,
        productQuantity: 1,
        paymentTypeId: 77800,
        paymentQuantity: 10,
      },
    ],
    machineInventory: [{ typeId: 84210, quantity: 1 }],
    buyerInventory: [{ typeId: 77800, quantity: 10 }],
    character: {
      id: characterId,
      ownerCapId: characterOwnerCapId,
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
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeDefined();

    const tradeButton = screen.getByRole("button", { name: "Connect Wallet" });
    expect(tradeButton.hasAttribute("disabled")).toBe(true);
  });

  it("submits a chain exchange transaction and refetches after connected trade", async () => {
    mocks.useConnection.mockReturnValue({ isConnected: true });
    mocks.useCurrentAccount.mockReturnValue({ address: sender });
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

  it("submits the selected slot listing when multiple slots are tradable", async () => {
    mocks.useConnection.mockReturnValue({ isConnected: true });
    mocks.useCurrentAccount.mockReturnValue({ address: sender });
    mockStorage(
      createSnapshot({
        listings: [
          {
            enabled: true,
            productTypeId: 84210,
            productQuantity: 1,
            paymentTypeId: 77800,
            paymentQuantity: 10,
          },
          {
            enabled: true,
            productTypeId: 84211,
            productQuantity: 3,
            paymentTypeId: 77801,
            paymentQuantity: 25,
          },
        ],
        machineInventory: [
          { typeId: 84210, quantity: 1 },
          { typeId: 84211, quantity: 3 },
        ],
        buyerInventory: [
          { typeId: 77800, quantity: 10 },
          { typeId: 77801, quantity: 25 },
        ],
      }),
    );

    render(<SupplyTerminal />);

    const tradeButtons = await screen.findAllByRole("button", {
      name: "TRADE",
    });
    fireEvent.click(tradeButtons[1]);

    const dialog = screen.getByRole("dialog", { name: "Confirm trade" });
    expect(within(dialog).getByText("Slot 02")).toBeDefined();
    expect(within(dialog).getByText("Item Type 84211 x3")).toBeDefined();
    expect(within(dialog).getAllByText("Item Type 77801 x25").length).toBeGreaterThan(
      0,
    );

    fireEvent.click(screen.getByRole("button", { name: "CONFIRM TRADE" }));

    await waitFor(() => {
      expect(mocks.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
    });

    const transaction = mocks.signAndExecuteTransaction.mock.calls[0]?.[0]
      .transaction as { toJSON: () => Promise<string> };
    const json = JSON.parse(await transaction.toJSON()) as {
      commands: Array<{
        MoveCall: {
          package: string;
          module: string;
          function: string;
          arguments: unknown[];
        };
      }>;
    };

    expect(json.commands[1]?.MoveCall.arguments).toHaveLength(5);
  });
});
