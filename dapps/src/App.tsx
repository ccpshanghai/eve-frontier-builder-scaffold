import { useMemo } from "react";
import { useSmartObject } from "@evefrontier/dapp-kit";
import { SupplyTerminal } from "./components/SupplyTerminal/SupplyTerminal";
import { deriveTenantObjectId } from "./objectIds";

function readQueryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)?.trim() || null;
}

function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return String(error);
}

function canUseEnvStorageObjectId(): boolean {
  return import.meta.env.VITE_APP_ENV === "local";
}

function getTenantItemStorageObjectId(): string | null {
  const tenant = readQueryParam("tenant");
  const itemId = readQueryParam("itemId");
  const registryId = import.meta.env.VITE_WORLD_OBJECT_REGISTRY_ID?.trim();
  const packageId = import.meta.env.VITE_EVE_WORLD_PACKAGE_ID?.trim();

  if (!tenant || !itemId || !registryId || !packageId) {
    return null;
  }

  try {
    return deriveTenantObjectId({
      registryId,
      itemId,
      packageId,
      tenant,
    });
  } catch {
    return null;
  }
}

function App() {
  const directStorageObjectId = useMemo(() => readQueryParam("objectId"), []);
  const tenantItemStorageObjectId = useMemo(getTenantItemStorageObjectId, []);
  const usesSmartObjectSelector = useMemo(
    () => Boolean(readQueryParam("tenant") || readQueryParam("itemId")),
    [],
  );
  const usesEnvStorageObjectId =
    !usesSmartObjectSelector && canUseEnvStorageObjectId();
  const { assembly, loading, error } = useSmartObject();
  const smartObjectId = assembly?.id ?? null;
  const storageObjectId =
    directStorageObjectId ?? tenantItemStorageObjectId ?? smartObjectId;
  const storageObjectIdLoading =
    !directStorageObjectId &&
    !tenantItemStorageObjectId &&
    usesSmartObjectSelector &&
    loading;
  const storageObjectIdError =
    !directStorageObjectId &&
    !tenantItemStorageObjectId &&
    usesSmartObjectSelector &&
    !loading &&
    !smartObjectId
      ? (getErrorMessage(error) ?? "No storage object found for URL selector")
      : !directStorageObjectId &&
          !usesSmartObjectSelector &&
          !usesEnvStorageObjectId
        ? "Missing storage selector. Open this Supply Terminal with ?objectId=0x... or ?tenant=stillness&itemId=..."
        : null;

  return (
    <SupplyTerminal
      storageObjectId={storageObjectId}
      storageObjectIdLoading={storageObjectIdLoading}
      storageObjectIdError={storageObjectIdError}
    />
  );
}

export default App;
