/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_OBJECT_ID?: string;
  readonly VITE_EVE_WORLD_PACKAGE_ID?: string;
  readonly VITE_SUPPLY_TERMINAL_PACKAGE_ID?: string;
  readonly VITE_SUPPLY_TERMINAL_CONFIG_ID?: string;
  readonly VITE_WORLD_OBJECT_REGISTRY_ID?: string;
  readonly VITE_SUI_GRAPHQL_ENDPOINT?: string;
  readonly VITE_SUI_RPC_URL?: string;
  readonly VITE_PLAYER_PRIVATE_KEY?: string;
}
