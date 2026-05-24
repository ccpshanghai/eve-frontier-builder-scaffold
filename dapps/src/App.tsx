import { useMemo } from "react";
import { useSmartObject } from "@evefrontier/dapp-kit";
import { SupplyTerminal } from "./components/SupplyTerminal/SupplyTerminal";

function readQueryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)?.trim() || null;
}

function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return String(error);
}

function App() {
  const directStorageObjectId = useMemo(() => readQueryParam("objectId"), []);
  const usesSmartObjectSelector = useMemo(
    () => Boolean(readQueryParam("tenant") || readQueryParam("itemId")),
    [],
  );
  const { assembly, loading, error } = useSmartObject();
  const smartObjectId = assembly?.id ?? null;
  const storageObjectId = directStorageObjectId ?? smartObjectId;
  const storageObjectIdLoading =
    !directStorageObjectId && usesSmartObjectSelector && loading;
  const storageObjectIdError =
    !directStorageObjectId &&
    usesSmartObjectSelector &&
    !loading &&
    !smartObjectId
      ? (getErrorMessage(error) ?? "No storage object found for URL selector")
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
