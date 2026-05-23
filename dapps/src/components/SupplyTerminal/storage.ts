import { useEffect, useState } from "react";
import { getObjectWithJson } from "@evefrontier/dapp-kit";

export interface SupplyTerminalStorage {
    id: string;
    type: string;
    status: string;
    extension: string;
}

interface SupplyTerminalStorageState {
    storage: SupplyTerminalStorage | null;
    loading: boolean;
    error: string | null;
}

interface StorageObjectJson {
    id?: string;
    status?: {
        status?: {
            "@variant"?: string;
        };
    };
    extension?: string;
}

interface ObjectWithJsonResult {
    data?: {
        object?: {
            asMoveObject?: {
                contents?: {
                    type?: {
                        repr?: string;
                    };
                    json?: StorageObjectJson;
                };
            };
        };
    };
}

const INITIAL_STATE: SupplyTerminalStorageState = {
    storage: null,
    loading: true,
    error: null,
};

export function getSupplyTerminalStorageObjectId(
    env: ImportMetaEnv = import.meta.env,
): string {
    return env.VITE_OBJECT_ID?.trim() ?? "";
}

export function parseSupplyTerminalStorageObject(
    result: unknown,
    objectId: string,
): SupplyTerminalStorage | null {
    const contents = (result as ObjectWithJsonResult).data?.object?.asMoveObject
        ?.contents;

    if (!contents?.json) {
        return null;
    }

    const type = contents.type?.repr ?? "";
    if (!type.includes("::storage_unit::StorageUnit")) {
        return null;
    }

    return {
        id: contents.json.id ?? objectId,
        type,
        status: contents.json.status?.status?.["@variant"] ?? "UNKNOWN",
        extension: contents.json.extension ?? "",
    };
}

export function useSupplyTerminalStorage(
    objectId = getSupplyTerminalStorageObjectId(),
): SupplyTerminalStorageState {
    const [state, setState] =
        useState<SupplyTerminalStorageState>(INITIAL_STATE);

    useEffect(() => {
        let ignore = false;
        const trimmedObjectId = objectId.trim();

        if (!trimmedObjectId) {
            setState({
                storage: null,
                loading: false,
                error: "VITE_OBJECT_ID is not configured",
            });
            return;
        }

        setState((previousState) => ({
            ...previousState,
            loading: true,
            error: null,
        }));

        void getObjectWithJson(trimmedObjectId)
            .then((result) => {
                if (ignore) return;

                setState({
                    storage: parseSupplyTerminalStorageObject(
                        result,
                        trimmedObjectId,
                    ),
                    loading: false,
                    error: null,
                });
            })
            .catch((err: unknown) => {
                if (ignore) return;

                setState({
                    storage: null,
                    loading: false,
                    error: err instanceof Error ? err.message : String(err),
                });
            });

        return () => {
            ignore = true;
        };
    }, [objectId]);

    return state;
}
