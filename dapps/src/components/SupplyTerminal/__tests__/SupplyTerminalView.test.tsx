import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { SupplyTerminalView } from "../SupplyTerminalView";
import { buildSupplyTerminalSlots } from "../slots";
import type {
  ExchangeEvent,
  ListingConfig,
  SupplyTerminalPreflightView,
  SupplyTerminalSlot,
} from "../types";

const mocks = vi.hoisted(() => ({
  useConnection: vi.fn(),
  useCurrentAccount: vi.fn(),
}));

vi.mock("@evefrontier/dapp-kit", () => ({
  useConnection: mocks.useConnection,
}));

vi.mock("@mysten/dapp-kit-react", () => ({
  useCurrentAccount: mocks.useCurrentAccount,
}));

const walletAddress = "0x8f21aabbccddeeffdA90";

const listing: ListingConfig = {
  enabled: true,
  productTypeId: 84210,
  productQuantity: 1,
  paymentTypeId: 77800,
  paymentQuantity: 10,
};

function createPreflight(): SupplyTerminalPreflightView {
  return {
    listing,
    paymentAvailable: true,
    machineStockAvailable: true,
    listingEnabled: true,
    extensionAuthorized: true,
    disabledReason: undefined,
  };
}

function createReadySlots(): SupplyTerminalSlot[] {
  return buildSupplyTerminalSlots({
    preflightViews: [createPreflight()],
    submitting: false,
  });
}

function createEvents(): ExchangeEvent[] {
  return [
    {
      type: "local",
      message: "Terminal inventory synchronized",
      timestamp: 1000,
    },
    {
      type: "chain",
      message: "Slot 01 price available",
      digest: "0xabcdef1234567890",
      timestamp: 2000,
    },
  ];
}

function renderView(
  overrides: Partial<ComponentProps<typeof SupplyTerminalView>> = {},
) {
  const props: ComponentProps<typeof SupplyTerminalView> = {
    isOwner: false,
    extensionAuthorized: true,
    isAuthorizing: false,
    storageStatus: "ONLINE",
    slots: createReadySlots(),
    events: createEvents(),
    selectedTradeSlot: null,
    tradeSubmitting: false,
    tradeError: null,
    onAuthorize: vi.fn(),
    onConfigure: vi.fn(),
    onOpenTrade: vi.fn(),
    onCancelTrade: vi.fn(),
    onConfirmTrade: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<SupplyTerminalView {...props} />),
  };
}

beforeEach(() => {
  mocks.useConnection.mockReturnValue({
    handleConnect: vi.fn(),
    handleDisconnect: vi.fn(),
    isConnected: true,
  });
  mocks.useCurrentAccount.mockReturnValue({ address: walletAddress });
});

describe("SupplyTerminalView", () => {
  it("renders the terminal shell topbar, vending grid, and bottom event log", () => {
    const { container } = renderView();

    const shell = container.querySelector(".st-terminal-shell");
    expect(shell).not.toBeNull();
    expect(shell?.querySelector(".st-terminal__topbar")).not.toBeNull();
    expect(shell?.querySelector(".st-terminal__brand")).not.toBeNull();
    expect(screen.getByText("ST").className).toBe("st-terminal__mark");
    expect(screen.getByText("EVE FRONTIER DAPP")).toBeDefined();
    expect(screen.getByText("SUPPLY TERMINAL")).toBeDefined();

    const status = shell?.querySelector(".st-terminal__status");
    expect(status).not.toBeNull();
    expect(within(status as HTMLElement).getByText("STORAGE")).toBeDefined();
    expect(within(status as HTMLElement).getByText("ONLINE")).toBeDefined();
    expect(
      within(status as HTMLElement).getByText("0x8f21...dA90"),
    ).toBeDefined();

    const content = shell?.querySelector(".st-terminal__content");
    expect(content).not.toBeNull();
    expect(content?.children).toHaveLength(2);
    expect(content?.children[0].querySelector(".st-slot-grid")).not.toBeNull();
    expect(content?.children[1].classList.contains("st-event-log")).toBe(true);
    expect(screen.getByText("SALE SLOTS")).toBeDefined();
    expect(screen.getByRole("region", { name: "EVENT LOG" })).toBe(
      content?.children[1],
    );
    expect(screen.getByText("> Terminal inventory synchronized")).toBeDefined();
  });

  it("routes a ready slot trade action to onOpenTrade", () => {
    const onOpenTrade = vi.fn();
    const slots = createReadySlots();

    renderView({ slots, onOpenTrade });
    fireEvent.click(screen.getByRole("button", { name: "TRADE" }));

    expect(onOpenTrade).toHaveBeenCalledTimes(1);
    expect(onOpenTrade).toHaveBeenCalledWith(slots[0]);
  });

  it("renders owner authorization controls without hiding selected trade dialog", () => {
    const onAuthorize = vi.fn();
    const onCancelTrade = vi.fn();
    const slots = createReadySlots();

    renderView({
      isOwner: true,
      extensionAuthorized: false,
      slots,
      selectedTradeSlot: slots[0],
      tradeError: "Wallet rejected transaction",
      onAuthorize,
      onCancelTrade,
    });

    fireEvent.click(screen.getByRole("button", { name: "AUTHORIZE" }));

    expect(screen.getByText("EXTENSION NOT AUTHORIZED")).toBeDefined();
    expect(onAuthorize).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Confirm trade" })).toBeDefined();
    expect(screen.getByText("Wallet rejected transaction")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
    expect(onCancelTrade).toHaveBeenCalledTimes(1);
  });

  it("routes selected dialog confirmation to onConfirmTrade with the selected slot", () => {
    const onConfirmTrade = vi.fn();
    const slots = createReadySlots();

    renderView({
      slots,
      selectedTradeSlot: slots[0],
      onConfirmTrade,
    });

    fireEvent.click(screen.getByRole("button", { name: "CONFIRM TRADE" }));

    expect(onConfirmTrade).toHaveBeenCalledTimes(1);
    expect(onConfirmTrade).toHaveBeenCalledWith(slots[0]);
  });
});
