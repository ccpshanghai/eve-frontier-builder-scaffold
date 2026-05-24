import type { ClientWithCoreApi } from "@mysten/dapp-kit-core";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import type {
  IdentifierArray,
  IdentifierString,
  StandardConnectFeature,
  StandardConnectMethod,
  StandardEventsFeature,
  StandardEventsOnMethod,
  SuiFeatures,
  SuiSignAndExecuteTransactionMethod,
  SuiSignPersonalMessageMethod,
  SuiSignTransactionMethod,
  Wallet,
} from "@mysten/wallet-standard";
import {
  getWallets,
  ReadonlyWalletAccount,
  StandardConnect,
  StandardEvents,
  SuiSignAndExecuteTransaction,
  SuiSignPersonalMessage,
  SuiSignTransaction,
} from "@mysten/wallet-standard";

import type { LocalDevWalletConfig } from "./localProviderConfig";

type WalletInitializer = {
  id: string;
  initialize(input: {
    networks: string[];
    getClient: (network?: string) => ClientWithCoreApi;
  }): { unregister: () => void } | Promise<{ unregister: () => void }>;
};

export function createLocalDevWalletInitializer(
  config: LocalDevWalletConfig,
): WalletInitializer {
  return {
    id: `${config.id}-initializer`,
    async initialize({ networks, getClient }) {
      const wallet = new LocalPrivateKeyWallet({
        name: config.name,
        keypair: Ed25519Keypair.fromSecretKey(config.privateKey),
        clients: networks.map((network) => getClient(network)),
      });

      const unregister = getWallets().register(wallet);
      return { unregister };
    },
  };
}

export class LocalPrivateKeyWallet implements Wallet {
  #chainConfig: Record<IdentifierString, ClientWithCoreApi>;
  #keypair: Ed25519Keypair;
  #name: string;
  #account: ReadonlyWalletAccount;

  constructor({
    clients,
    keypair,
    name,
  }: {
    clients: ClientWithCoreApi[];
    keypair: Ed25519Keypair;
    name: string;
  }) {
    this.#chainConfig = clients.reduce<Record<IdentifierString, ClientWithCoreApi>>(
      (chainConfig, client) => {
        chainConfig[`sui:${client.network}`] = client;
        return chainConfig;
      },
      {},
    );
    this.#keypair = keypair;
    this.#name = name;
    this.#account = new ReadonlyWalletAccount({
      address: this.#keypair.getPublicKey().toSuiAddress(),
      publicKey: this.#keypair.getPublicKey().toSuiBytes(),
      chains: this.chains,
      features: [
        SuiSignTransaction,
        SuiSignAndExecuteTransaction,
        SuiSignPersonalMessage,
      ],
    });
  }

  get version() {
    return "1.0.0" as const;
  }

  get name() {
    return this.#name;
  }

  get icon() {
    return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDYwIDYwIj48cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHJ4PSIxMiIgZmlsbD0iIzE2MWIyMiIvPjxwYXRoIGQ9Ik0zMCA5bDE3IDl2MjRsLTE3IDktMTctOVYxOGwxNy05eiIgZmlsbD0iIzJmODFmNyIvPjxwYXRoIGQ9Ik0zMCAxN2w5IDV2MTZsLTkgNS05LTVWMjJsOS01eiIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg==" as const;
  }

  get chains() {
    return Object.keys(this.#chainConfig) as IdentifierArray;
  }

  get accounts() {
    return [this.#account];
  }

  get features(): StandardConnectFeature & StandardEventsFeature & SuiFeatures {
    return {
      [StandardConnect]: {
        version: "1.0.0",
        connect: this.#connect,
      },
      [StandardEvents]: {
        version: "1.0.0",
        on: this.#on,
      },
      [SuiSignPersonalMessage]: {
        version: "1.1.0",
        signPersonalMessage: this.#signPersonalMessage,
      },
      [SuiSignTransaction]: {
        version: "2.0.0",
        signTransaction: this.#signTransaction,
      },
      [SuiSignAndExecuteTransaction]: {
        version: "2.0.0",
        signAndExecuteTransaction: this.#signAndExecuteTransaction,
      },
    };
  }

  #on: StandardEventsOnMethod = () => {
    return () => {};
  };

  #connect: StandardConnectMethod = async () => {
    return { accounts: this.accounts };
  };

  #signPersonalMessage: SuiSignPersonalMessageMethod = async (messageInput) => {
    return this.#keypair.signPersonalMessage(messageInput.message);
  };

  #signTransaction: SuiSignTransactionMethod = async ({
    chain,
    signal,
    transaction,
  }) => {
    signal?.throwIfAborted();

    const client = this.#chainConfig[chain];
    if (!client) throw new Error(`Invalid chain "${chain}" specified.`);

    const parsedTransaction = Transaction.from(await transaction.toJSON());
    const builtTransaction = await parsedTransaction.build({ client });
    return this.#keypair.signTransaction(builtTransaction);
  };

  #signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod = async ({
    chain,
    signal,
    transaction,
  }) => {
    signal?.throwIfAborted();

    const client = this.#chainConfig[chain];
    if (!client) throw new Error(`Invalid chain "${chain}" specified.`);

    const parsedTransaction = Transaction.from(await transaction.toJSON());
    const bytes = await parsedTransaction.build({ client });
    const result = await this.#keypair.signAndExecuteTransaction({
      transaction: parsedTransaction,
      client,
    });
    const executedTransaction = result.Transaction ?? result.FailedTransaction;

    return {
      bytes: toBase64(bytes),
      digest: executedTransaction.digest,
      effects: toBase64(executedTransaction.effects.bcs!),
      signature: executedTransaction.signatures[0],
    };
  };
}
