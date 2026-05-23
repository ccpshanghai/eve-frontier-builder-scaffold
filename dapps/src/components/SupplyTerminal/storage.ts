import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  createSupplyTerminalRpcClient,
  loadSupplyTerminalSnapshot,
  readSupplyTerminalEnv,
} from "./chain";
import type {
  SupplyTerminalChainEnv,
  SupplyTerminalChainSnapshot,
  SupplyTerminalStorageSnapshot,
} from "./types";

interface SupplyTerminalStorageStateData {
  snapshot: SupplyTerminalChainSnapshot | null;
  storage: SupplyTerminalStorageSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  env: SupplyTerminalChainEnv | null;
}

export interface SupplyTerminalStorageState extends SupplyTerminalStorageStateData {
  refetch: () => Promise<void>;
}

type SupplyTerminalStorageOptions = {
  accountAddress?: string | null;
};

type StateCommit = Dispatch<SetStateAction<SupplyTerminalStorageStateData>>;

const INITIAL_STATE: SupplyTerminalStorageStateData = {
  snapshot: null,
  storage: null,
  loading: true,
  refreshing: false,
  error: null,
  env: null,
};

export function useSupplyTerminalStorage({
  accountAddress,
}: SupplyTerminalStorageOptions = {}): SupplyTerminalStorageState {
  const [state, setState] =
    useState<SupplyTerminalStorageStateData>(INITIAL_STATE);

  const load = useCallback(
    async (initial: boolean, commit: StateCommit = setState) => {
      commit((previousState) => ({
        ...previousState,
        loading: initial,
        refreshing: !initial,
        error: null,
      }));

      try {
        const env = readSupplyTerminalEnv();
        const client = createSupplyTerminalRpcClient(env);
        const snapshot = await loadSupplyTerminalSnapshot({
          env,
          client,
          accountAddress,
        });

        commit({
          snapshot,
          storage: snapshot.storage,
          loading: false,
          refreshing: false,
          error: null,
          env,
        });
      } catch (err) {
        commit({
          snapshot: null,
          storage: null,
          loading: false,
          refreshing: false,
          error: err instanceof Error ? err.message : String(err),
          env: null,
        });
      }
    },
    [accountAddress],
  );

  useEffect(() => {
    let ignore = false;
    const commit: StateCommit = (value) => {
      if (!ignore) {
        setState(value);
      }
    };

    void load(true, commit);

    return () => {
      ignore = true;
    };
  }, [load]);

  const refetch = useCallback(async () => {
    await load(false);
  }, [load]);

  return {
    ...state,
    refetch,
  };
}
