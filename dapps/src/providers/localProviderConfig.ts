export type DappEnv = Record<string, string | undefined>;

export type LocalDevWalletConfig = {
  id: string;
  label: "Player";
  name: string;
  privateKey: string;
};

const DEFAULT_LOCALNET_RPC_URL = "http://127.0.0.1:9000";

export function shouldUseLocalDappKit(env: DappEnv): boolean {
  return env.VITE_APP_ENV === "local";
}

export function getLocalnetRpcUrl(env: DappEnv): string {
  return env.VITE_SUI_RPC_URL?.trim() || DEFAULT_LOCALNET_RPC_URL;
}

export function getLocalDevWalletConfig(
  env: DappEnv,
): LocalDevWalletConfig | null {
  if (!shouldUseLocalDappKit(env)) return null;

  const privateKey = env.VITE_PLAYER_PRIVATE_KEY;
  if (!privateKey?.trim()) return null;

  return {
    id: "localnet-player",
    label: "Player",
    name: "Eve Vault Localnet Player",
    privateKey: privateKey.trim(),
  };
}
