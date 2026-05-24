import type { ReactNode } from "react";
import { EveFrontierProvider } from "@evefrontier/dapp-kit";
import {
  NotificationProvider,
  SmartObjectProvider,
  VaultProvider,
} from "@evefrontier/dapp-kit/providers";
import { createDAppKit } from "@mysten/dapp-kit-core";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { createLocalDevWalletInitializer } from "./localDevWallet";
import {
  getLocalDevWalletConfig,
  getLocalnetRpcUrl,
  shouldUseLocalDappKit,
} from "./localProviderConfig";

const LOCAL_NETWORKS: ["localnet"] = ["localnet"];

let localDAppKit: ReturnType<typeof createLocalDAppKit> | null = null;

export function DappProvider({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  if (!shouldUseLocalDappKit(import.meta.env)) {
    return (
      <EveFrontierProvider queryClient={queryClient}>
        {children}
      </EveFrontierProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={getLocalDAppKit(import.meta.env)}>
        <VaultProvider>
          <SmartObjectProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </SmartObjectProvider>
        </VaultProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  );
}

function getLocalDAppKit(env: ImportMetaEnv) {
  localDAppKit ??= createLocalDAppKit(env);
  return localDAppKit;
}

function createLocalDAppKit(env: ImportMetaEnv) {
  const localWalletConfig = getLocalDevWalletConfig(env);
  const rpcUrl = getLocalnetRpcUrl(env);

  return createDAppKit({
    networks: LOCAL_NETWORKS,
    defaultNetwork: "localnet",
    slushWalletConfig: null,
    storageKey: "eve-frontier-localnet-dev-wallet",
    walletInitializers: localWalletConfig
      ? [createLocalDevWalletInitializer(localWalletConfig)]
      : [],
    createClient(network) {
      return new SuiJsonRpcClient({
        network,
        url: rpcUrl,
      });
    },
  });
}
