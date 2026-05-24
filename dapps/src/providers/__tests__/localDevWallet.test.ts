// @vitest-environment node

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { StandardConnect, SuiSignPersonalMessage } from "@mysten/wallet-standard";
import { describe, expect, it } from "vitest";

import { LocalPrivateKeyWallet } from "../localDevWallet";

describe("LocalPrivateKeyWallet", () => {
  it("exposes a localnet wallet-standard account derived from the configured keypair", async () => {
    const keypair = Ed25519Keypair.fromSecretKey(
      Uint8Array.from({ length: 32 }, (_, index) => index + 1),
    );
    const wallet = new LocalPrivateKeyWallet({
      keypair,
      name: "Eve Vault Localnet Player",
      clients: [{ network: "localnet" } as any],
    });

    const account = wallet.accounts[0];

    expect(wallet.name).toBe("Eve Vault Localnet Player");
    expect(wallet.chains).toEqual(["sui:localnet"]);
    expect(account.address).toBe(keypair.getPublicKey().toSuiAddress());
    expect(account.chains).toEqual(["sui:localnet"]);
    expect(account.features).toContain(SuiSignPersonalMessage);
    await expect(wallet.features[StandardConnect].connect()).resolves.toEqual({
      accounts: wallet.accounts,
    });
  });
});
