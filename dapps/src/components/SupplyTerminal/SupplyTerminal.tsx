import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "@evefrontier/dapp-kit";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import {
  buildSupplyTerminalAuthorizeExtensionTransaction,
  buildSupplyTerminalExchangeTransaction,
  isSupplyTerminalExtensionAuthorized,
  probeStorageUnitOwnerCapBorrow,
  validateSupplyTerminalListings,
} from "./chain";
import { AuthorizeExtensionDialog } from "./AuthorizeExtensionDialog";
import { buildSupplyTerminalSlots } from "./slots";
import { SupplyTerminalView } from "./SupplyTerminalView";
import type { ExchangeEvent, SupplyTerminalSlot } from "./types";
import { useSupplyTerminalStorage } from "./storage";
import "./SupplyTerminal.css";

export function SupplyTerminal() {
  const { isConnected } = useConnection();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const {
    snapshot,
    storage,
    loading: storageLoading,
    refreshing: storageRefreshing,
    error: storageError,
    env,
    refetch,
  } = useSupplyTerminalStorage({
    accountAddress: account?.address,
  });

  const [events, setEvents] = useState<ExchangeEvent[]>([
    {
      type: "local",
      message: "Terminal inventory synchronized",
      timestamp: Date.now(),
    },
  ]);
  const [selectedTradeSlot, setSelectedTradeSlot] =
    useState<SupplyTerminalSlot | null>(null);
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [isStorageOwner, setIsStorageOwner] = useState(false);
  const [authorizeDialogOpen, setAuthorizeDialogOpen] = useState(false);
  const [authorizeError, setAuthorizeError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const tradeInFlightRef = useRef(false);
  const authorizationProbeKeyRef = useRef<string | null>(null);
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const walletConnected = isConnected && Boolean(account);
  const preflightViews = useMemo(
    () => (snapshot ? validateSupplyTerminalListings(snapshot) : []),
    [snapshot],
  );
  const extensionAuthorized =
    preflightViews[0]?.extensionAuthorized ??
    isSupplyTerminalExtensionAuthorized(snapshot?.storage.extension);
  const owner = isStorageOwner && !authorizeDialogOpen;

  const addEvent = useCallback((event: Omit<ExchangeEvent, "timestamp">) => {
    setEvents((previousEvents) => [
      ...previousEvents,
      { ...event, timestamp: Date.now() },
    ]);
  }, []);

  useEffect(() => {
    if (extensionAuthorized) {
      setAuthorizeDialogOpen(false);
      setAuthorizeError(null);
      return;
    }

    if (
      !walletConnected ||
      !account ||
      !env ||
      !snapshot ||
      storage?.status !== "ONLINE"
    ) {
      return;
    }

    const probeKey = [
      account.address,
      snapshot.storage.id,
      snapshot.storage.ownerCapId,
      snapshot.storage.ownerCharacterId,
      snapshot.storage.extension,
    ].join(":");

    if (authorizationProbeKeyRef.current === probeKey) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const ownerCapAvailable = await probeStorageUnitOwnerCapBorrow({
        env,
        snapshot,
        sender: account.address,
      });

      if (cancelled) return;
      authorizationProbeKeyRef.current = probeKey;

      if (!ownerCapAvailable) {
        const message =
          "Connected wallet is not the StorageUnit owner; extension authorization skipped";
        setIsStorageOwner(false);
        console.info(message);
        addEvent({
          type: "local",
          message,
        });
        return;
      }

      setIsStorageOwner(true);
      setAuthorizeError(null);
      setAuthorizeDialogOpen(true);
      addEvent({
        type: "local",
        message: "StorageUnit owner detected; extension authorization required",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    account,
    addEvent,
    env,
    extensionAuthorized,
    snapshot,
    storage?.status,
    walletConnected,
  ]);

  const slots = useMemo(
    () =>
      buildSupplyTerminalSlots({
        preflightViews,
        submitting: tradeSubmitting || storageRefreshing,
        walletConnected,
        machineInventory: snapshot?.machineInventory,
      }),
    [
      preflightViews,
      storageRefreshing,
      tradeSubmitting,
      walletConnected,
      snapshot,
    ],
  );
  const currentSelectedTradeSlot = useMemo(
    () =>
      selectedTradeSlot
        ? (slots.find((slot) => slot.id === selectedTradeSlot.id) ?? null)
        : null,
    [selectedTradeSlot, slots],
  );

  const handleOpenTrade = useCallback(
    (slot: SupplyTerminalSlot) => {
      setSelectedTradeSlot(slot);
      setTradeError(null);
      addEvent({
        type: "local",
        message: `${slot.label} trade confirmation opened`,
      });
    },
    [addEvent],
  );

  const handleCancelTrade = useCallback(() => {
    setSelectedTradeSlot(null);
    setTradeError(null);
    addEvent({
      type: "local",
      message: "Trade confirmation cancelled",
    });
    void refetch();
  }, [addEvent, refetch]);

  const handleConfirmTrade = useCallback(
    async (slot: SupplyTerminalSlot) => {
      if (tradeInFlightRef.current || tradeSubmitting) {
        return;
      }

      const currentSlot = slots.find(
        (candidate) =>
          candidate.id === slot.id && candidate.index === slot.index,
      );

      if (!currentSlot?.canTrade) {
        const message = "Selected slot is no longer available for trade";

        setTradeError(message);
        addEvent({
          type: "local",
          message: `Exchange blocked: ${message}`,
        });
        return;
      }

      if (!currentSlot.productTypeId) {
        const message =
          "Selected slot is not linked to a Supply Terminal listing";

        setTradeError(message);
        addEvent({
          type: "local",
          message: `Exchange blocked: ${message}`,
        });
        return;
      }

      if (!account || !env || !snapshot || !walletConnected) {
        const message = "Connect wallet to trade";

        setTradeError(message);
        addEvent({
          type: "local",
          message: `Exchange blocked: ${message}`,
        });
        return;
      }

      tradeInFlightRef.current = true;
      setTradeSubmitting(true);
      setTradeError(null);
      addEvent({
        type: "local",
        message: "Awaiting wallet confirmation",
      });

      try {
        const tx = buildSupplyTerminalExchangeTransaction({
          env,
          snapshot,
          sender: account.address,
          productTypeId: currentSlot.productTypeId,
        });

        const result = await dAppKit.signAndExecuteTransaction({
          transaction: tx,
        });
        const digest = (result as Record<string, unknown>).digest;

        addEvent({
          type: "chain",
          message: "Exchange submitted",
          ...(typeof digest === "string" ? { digest } : {}),
        });
        addEvent({
          type: "chain",
          message: "Exchange complete",
          ...(typeof digest === "string" ? { digest } : {}),
        });

        const preTradeStock = currentSlot.machineStockQuantity;
        const productTypeId = currentSlot.productTypeId;

        const maxAttempts = 20;
        const delayMs = 500;

        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          try {
            await refetch();
          } catch {
            // refetch handles errors internally, continue polling
          }

          const latest = snapshotRef.current;
          if (latest && preTradeStock != null && productTypeId != null) {
            const item = latest.machineInventory.find(
              (entry) => entry.typeId === productTypeId,
            );
            const newStock = item?.quantity ?? 0;
            if (newStock !== preTradeStock) {
              addEvent({
                type: "local",
                message: `${slot.label} stock confirmed`,
              });
              break;
            }
          }

          if (i === maxAttempts - 1) {
            addEvent({
              type: "local",
              message: `${slot.label} stock may be stale`,
            });
          }
        }

        setSelectedTradeSlot(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        setTradeError(message);
        addEvent({
          type: "local",
          message: `Exchange failed: ${message}`,
        });
        void refetch();
      } finally {
        tradeInFlightRef.current = false;
        setTradeSubmitting(false);
      }
    },
    [
      account,
      addEvent,
      dAppKit,
      env,
      refetch,
      slots,
      snapshot,
      tradeSubmitting,
      walletConnected,
    ],
  );

  const handleAuthorize = useCallback(() => {
    setAuthorizeError(null);
    setAuthorizeDialogOpen(true);
  }, []);

  const handleCancelAuthorize = useCallback(() => {
    setAuthorizeDialogOpen(false);
    setAuthorizeError(null);
    addEvent({
      type: "local",
      message: "Extension authorization cancelled",
    });
    void refetch();
  }, [addEvent, refetch]);

  const handleConfirmAuthorize = useCallback(async () => {
    if (!account || !env || !snapshot || !walletConnected || isAuthorizing) {
      return;
    }

    setIsAuthorizing(true);
    setAuthorizeError(null);
    addEvent({
      type: "local",
      message: "Awaiting wallet confirmation",
    });

    try {
      const tx = buildSupplyTerminalAuthorizeExtensionTransaction({
        env,
        snapshot,
        sender: account.address,
      });

      const result = await dAppKit.signAndExecuteTransaction({
        transaction: tx,
      });
      const digest = (result as Record<string, unknown>).digest;

      addEvent({
        type: "chain",
        message: "Extension authorization submitted",
        ...(typeof digest === "string" ? { digest } : {}),
      });

      const maxAttempts = 20;
      const delayMs = 500;

      for (let i = 0; i < maxAttempts; i++) {
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        const latest = await refetch();
        if (isSupplyTerminalExtensionAuthorized(latest?.storage.extension)) {
          addEvent({
            type: "chain",
            message: "Extension authorization confirmed",
            ...(typeof digest === "string" ? { digest } : {}),
          });
          setAuthorizeDialogOpen(false);
          setAuthorizeError(null);
          return;
        }
      }

      const message = "Extension authorization not confirmed yet";
      setAuthorizeError(message);
      addEvent({
        type: "local",
        message,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      setAuthorizeError(message);
      addEvent({
        type: "local",
        message: `Extension authorization failed: ${message}`,
      });
    } finally {
      setIsAuthorizing(false);
    }
  }, [
    account,
    addEvent,
    dAppKit,
    env,
    isAuthorizing,
    refetch,
    snapshot,
    walletConnected,
  ]);

  const handleConfigure = useCallback(() => {
    addEvent({
      type: "local",
      message: "Configure entry selected",
    });
  }, [addEvent]);

  if (storageLoading) {
    return <div className="st-screen-message">Loading storage...</div>;
  }

  if (storageError) {
    return <div className="st-screen-message">Error: {storageError}</div>;
  }

  if (!storage) {
    return <div className="st-screen-message">No storage found</div>;
  }

  return (
    <>
      <SupplyTerminalView
        isOwner={owner}
        extensionAuthorized={extensionAuthorized}
        isAuthorizing={isAuthorizing}
        storageStatus={storage.status}
        slots={slots}
        events={events}
        selectedTradeSlot={currentSelectedTradeSlot}
        tradeSubmitting={tradeSubmitting}
        tradeError={tradeError}
        onAuthorize={handleAuthorize}
        onConfigure={handleConfigure}
        onOpenTrade={handleOpenTrade}
        onCancelTrade={handleCancelTrade}
        onConfirmTrade={handleConfirmTrade}
      />
      <AuthorizeExtensionDialog
        open={authorizeDialogOpen}
        submitting={isAuthorizing}
        error={authorizeError}
        storageId={storage.id}
        onCancel={handleCancelAuthorize}
        onConfirm={handleConfirmAuthorize}
      />
    </>
  );
}
