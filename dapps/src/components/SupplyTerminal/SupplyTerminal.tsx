import { useCallback, useMemo, useRef, useState } from "react";
import { useConnection } from "@evefrontier/dapp-kit";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import {
  buildSupplyTerminalExchangeTransaction,
  validateSupplyTerminalSnapshot,
} from "./chain";
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
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const tradeInFlightRef = useRef(false);

  const walletConnected = isConnected && Boolean(account);
  const preflight = useMemo(
    () =>
      snapshot
        ? validateSupplyTerminalSnapshot(snapshot)
        : {
            paymentAvailable: false,
            machineStockAvailable: false,
            listingEnabled: false,
            extensionAuthorized: false,
            disabledReason: "Storage loading",
          },
    [snapshot],
  );
  const owner = false;

  const addEvent = useCallback((event: Omit<ExchangeEvent, "timestamp">) => {
    setEvents((previousEvents) => [
      ...previousEvents,
      { ...event, timestamp: Date.now() },
    ]);
  }, []);

  const slots = useMemo(
    () =>
      buildSupplyTerminalSlots({
        paymentAvailable: preflight.paymentAvailable,
        machineStockAvailable: preflight.machineStockAvailable,
        listingEnabled: preflight.listingEnabled,
        extensionAuthorized: preflight.extensionAuthorized,
        submitting: tradeSubmitting || storageRefreshing,
        sold: false,
        walletConnected,
        disabledReason: preflight.disabledReason,
      }),
    [preflight, storageRefreshing, tradeSubmitting, walletConnected],
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
  }, [addEvent]);

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
        });

        const result = await dAppKit.signAndExecuteTransaction({
          transaction: tx,
        });
        const digest = (result as Record<string, unknown>).digest;

        setSelectedTradeSlot(null);
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
        try {
          await refetch();
          addEvent({
            type: "local",
            message: `${slot.label} refreshed`,
          });
        } catch (refreshError) {
          addEvent({
            type: "local",
            message: `Refresh failed: ${
              refreshError instanceof Error
                ? refreshError.message
                : String(refreshError)
            }`,
          });
        }
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

  const handleAuthorize = useCallback(async () => {
    if (!account || !walletConnected) return;

    setIsAuthorizing(true);

    try {
      addEvent({
        type: "local",
        message: "Authorization must be run from the admin script",
      });
    } finally {
      setIsAuthorizing(false);
    }
  }, [account, addEvent, walletConnected]);

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
    <SupplyTerminalView
      isOwner={owner}
      extensionAuthorized={preflight.extensionAuthorized}
      isAuthorizing={isAuthorizing}
      storageStatus={storage.status}
      walletAddress={account?.address ?? null}
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
  );
}
