// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  getLocalDevWalletConfig,
  getLocalnetRpcUrl,
  shouldUseLocalDappKit,
} from "../localProviderConfig";

describe("local provider config", () => {
  it("only enables the local dapp-kit provider when VITE_APP_ENV is local", () => {
    expect(shouldUseLocalDappKit({ VITE_APP_ENV: "local" })).toBe(true);
    expect(shouldUseLocalDappKit({ VITE_APP_ENV: "testnet" })).toBe(false);
    expect(shouldUseLocalDappKit({})).toBe(false);
  });

  it("uses the localnet RPC url override with a safe default", () => {
    expect(getLocalnetRpcUrl({})).toBe("http://127.0.0.1:9000");
    expect(getLocalnetRpcUrl({ VITE_SUI_RPC_URL: "http://localhost:9000" })).toBe(
      "http://localhost:9000",
    );
  });

  it("uses a single local player private key only in local env", () => {
    expect(
      getLocalDevWalletConfig({
        VITE_APP_ENV: "local",
        VITE_PLAYER_PRIVATE_KEY: "player-key",
      }),
    ).toEqual({
      id: "localnet-player",
      label: "Player",
      name: "Eve Vault Localnet Player",
      privateKey: "player-key",
    });

    expect(
      getLocalDevWalletConfig({
        VITE_APP_ENV: "testnet",
        VITE_PLAYER_PRIVATE_KEY: "player-key",
      }),
    ).toBeNull();
  });
});
