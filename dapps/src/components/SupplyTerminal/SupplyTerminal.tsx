import { useState, useCallback } from "react";
import { Box, Grid } from "@radix-ui/themes";
import { useSmartObject, useConnection, isOwner } from "@evefrontier/dapp-kit";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { ProductPanel } from "./ProductPanel";
import { PurchasePanel } from "./PurchasePanel";
import { InventoryPanel } from "./InventoryPanel";
import { MachinePanel } from "./MachinePanel";
import { EventLog } from "./EventLog";
import { OwnerControls } from "./OwnerControls";
import { ExchangeState, ExchangeEvent } from "./types";
import { SUPPLY_TERMINAL_CONFIG } from "./config";

export function SupplyTerminal() {
    const { assembly, loading, error: smartObjectError } = useSmartObject();
    const { isConnected } = useConnection();
    const account = useCurrentAccount();
    const dAppKit = useDAppKit();

    // State
    const [exchangeState, setExchangeState] = useState<ExchangeState>("idle");
    const [selected, setSelected] = useState(false);
    const [events, setEvents] = useState<ExchangeEvent[]>([]);
    const [isAuthorizing, setIsAuthorizing] = useState(false);

    // TODO: Replace placeholders with actual GraphQL queries for inventory
    const [playerFeldspar] = useState(0);
    const [playerCarbonWeave] = useState(0);
    const [machineStock] = useState(0);
    const [machineRevenue] = useState(0);
    const [machineOnline] = useState(false);
    const [extensionAuthorized, setExtensionAuthorized] = useState(false);

    const owner = isOwner(assembly, account?.address);

    const addEvent = useCallback((e: ExchangeEvent) => {
        setEvents(prev => [...prev, { ...e, timestamp: Date.now() }]);
    }, []);

    const handleSelect = () => {
        setSelected(true);
        setExchangeState("selected");
        addEvent({ type: "local", message: `Product selected: ${SUPPLY_TERMINAL_CONFIG.product.name}`, timestamp: 0 });
    };

    const handleStagePayment = () => {
        setExchangeState("payment_staged");
        addEvent({ type: "local", message: `Payment staged: ${SUPPLY_TERMINAL_CONFIG.payment.name} x${SUPPLY_TERMINAL_CONFIG.payment.quantity}`, timestamp: 0 });
    };

    const handleCancel = () => {
        setSelected(false);
        setExchangeState("idle");
        addEvent({ type: "local", message: "Purchase cancelled before confirmation", timestamp: 0 });
    };

    const handleConfirmExchange = async () => {
        if (!assembly || !account) return;

        setExchangeState("submitting");
        addEvent({ type: "local", message: "Exchange submitted", timestamp: 0 });

        try {
            const tx = new Transaction();
            tx.setSender(account.address);

            // TODO: Build actual exchange transaction with real IDs
            const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

            setExchangeState("completed");
            addEvent({ type: "chain", message: "Payment accepted", timestamp: 0 });
            addEvent({ type: "chain", message: "Product dispensed", timestamp: 0 });
            addEvent({ type: "chain", message: `Exchange completed — ${(result as Record<string, unknown>).digest || "done"}`, timestamp: 0 });
        } catch (err) {
            setExchangeState("failed");
            const msg = (err as Error).message || String(err);
            addEvent({ type: "local", message: `Confirm failed: ${msg}`, timestamp: 0 });
        }
    };

    const handleAuthorize = async () => {
        if (!assembly || !account) return;

        setIsAuthorizing(true);
        try {
            const tx = new Transaction();
            tx.setSender(account.address);

            // TODO: Build actual authorize_extension transaction
            const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
            setExtensionAuthorized(true);
            addEvent({ type: "chain", message: `Extension authorized — ${(result as Record<string, unknown>).digest || "done"}`, timestamp: 0 });
        } catch (err) {
            addEvent({ type: "local", message: `Authorization failed: ${(err as Error).message}`, timestamp: 0 });
        } finally {
            setIsAuthorizing(false);
        }
    };

    const handleConfigure = () => {
        // TODO: Open configure dialog for listing rules (future)
        addEvent({ type: "local", message: "Configure panel not yet implemented", timestamp: 0 });
    };

    if (loading) return <div>Loading assembly...</div>;
    if (smartObjectError) return <div>Error: {smartObjectError}</div>;
    if (!assembly) return <div>No assembly found</div>;
    if (!isConnected) return <div>Connect your wallet to use the Supply Terminal</div>;

    return (
        <Box>
            {/* Owner-only: authorize banner + configure button */}
            <OwnerControls
                isOwner={owner}
                extensionAuthorized={extensionAuthorized}
                onAuthorize={handleAuthorize}
                isAuthorizing={isAuthorizing}
                onConfigure={handleConfigure}
            />

            <Grid columns="2" gap="4" mt="4">
                <ProductPanel
                    stock={machineStock}
                    onSelect={handleSelect}
                    selected={selected}
                    disabled={!isConnected || exchangeState === "submitting"}
                />
                <InventoryPanel
                    feldsparCrystals={playerFeldspar}
                    carbonWeave={playerCarbonWeave}
                />
                <PurchasePanel
                    selected={selected}
                    playerFeldspar={playerFeldspar}
                    machineStock={machineStock}
                    exchangeState={exchangeState}
                    onStagePayment={handleStagePayment}
                    onConfirmExchange={handleConfirmExchange}
                    onCancel={handleCancel}
                />
                <MachinePanel
                    carbonWeaveStock={machineStock}
                    feldsparCrystalsRevenue={machineRevenue}
                    online={machineOnline}
                    extensionAuthorized={extensionAuthorized}
                />
            </Grid>

            <Box mt="4">
                <EventLog events={events} />
            </Box>
        </Box>
    );
}
