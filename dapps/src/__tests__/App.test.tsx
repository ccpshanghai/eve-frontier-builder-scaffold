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
    vi.stubEnv("VITE_EVE_WORLD_PACKAGE_ID", "");
    vi.stubEnv("VITE_WORLD_OBJECT_REGISTRY_ID", "");
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

  it("derives the storage object id from tenant and itemId without waiting for wallet-backed smart object loading", () => {
    vi.stubEnv(
      "VITE_EVE_WORLD_PACKAGE_ID",
      "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c",
    );
    vi.stubEnv(
      "VITE_WORLD_OBJECT_REGISTRY_ID",
      "0x454a9aa3d37e1d08d3c9181239c1b683781e4087fbbbd48c935d54b6736fd05c",
    );
    window.history.replaceState(
      null,
      "",
      "/?tenant=stillness&itemId=1000000391647",
    );
    mocks.useSmartObject.mockReturnValue({
      assembly: null,
      loading: true,
      error: null,
    });

    render(<App />);

    expect(renderedSupplyTerminalProps()).toMatchObject({
      storageObjectId:
        "0xdfbe83ecb11d1d630c7c53a0c6eef84cfada670e143d6923445fd8a17aa7ec9e",
      storageObjectIdLoading: false,
      storageObjectIdError: null,
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
