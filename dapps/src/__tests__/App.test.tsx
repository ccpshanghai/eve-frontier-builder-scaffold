import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const mocks = vi.hoisted(() => ({
  useSmartObject: vi.fn(),
  SupplyTerminal: vi.fn(() => null),
}));

vi.mock("@evefrontier/dapp-kit", () => ({
  useSmartObject: mocks.useSmartObject,
}));

vi.mock("../components/SupplyTerminal/SupplyTerminal", () => ({
  SupplyTerminal: mocks.SupplyTerminal,
}));

function renderedSupplyTerminalProps(): Record<string, unknown> {
  const calls = mocks.SupplyTerminal.mock.calls as unknown as Array<
    [Record<string, unknown>]
  >;
  return calls[calls.length - 1]?.[0] ?? {};
}

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    vi.stubEnv("VITE_APP_ENV", "testnet");
    mocks.useSmartObject.mockReturnValue({
      assembly: null,
      loading: false,
      error: null,
    });
    mocks.SupplyTerminal.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("passes query objectId directly to the Supply Terminal", () => {
    window.history.replaceState(
      null,
      "",
      "/?tenant=stillness&itemId=888800007&objectId=0xdirect",
    );
    mocks.useSmartObject.mockReturnValue({
      assembly: { id: "0xassembly" },
      loading: false,
      error: null,
    });

    render(<App />);

    expect(renderedSupplyTerminalProps()).toMatchObject({
      storageObjectId: "0xdirect",
    });
  });

  it("uses the smart object assembly id when objectId is absent", () => {
    window.history.replaceState(
      null,
      "",
      "/?tenant=stillness&itemId=888800007",
    );
    mocks.useSmartObject.mockReturnValue({
      assembly: { id: "0xassembly" },
      loading: false,
      error: null,
    });

    render(<App />);

    expect(renderedSupplyTerminalProps()).toMatchObject({
      storageObjectId: "0xassembly",
    });
  });

  it("blocks the env fallback path outside local development", () => {
    render(<App />);

    expect(renderedSupplyTerminalProps()).toMatchObject({
      storageObjectId: null,
      storageObjectIdError:
        "Missing storage selector. Open this Supply Terminal with ?objectId=0x... or ?tenant=stillness&itemId=...",
    });
  });

  it("keeps the env fallback path for local development", () => {
    vi.stubEnv("VITE_APP_ENV", "local");

    render(<App />);

    expect(renderedSupplyTerminalProps()).toMatchObject({
      storageObjectId: null,
      storageObjectIdError: null,
    });
  });
});
