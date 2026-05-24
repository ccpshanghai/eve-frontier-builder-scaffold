import { Card, Button, Text, Flex, Heading, Badge } from "@radix-ui/themes";
import { ExchangeState } from "./types";
import { SUPPLY_TERMINAL_CONFIG } from "./config";

interface PurchasePanelProps {
    selected: boolean;
    playerFeldspar: number;
    machineStock: number;
    exchangeState: ExchangeState;
    onStagePayment: () => void;
    onConfirmExchange: () => void;
    onCancel: () => void;
}

export function PurchasePanel({
    selected,
    playerFeldspar,
    machineStock,
    exchangeState,
    onStagePayment,
    onConfirmExchange,
    onCancel,
}: PurchasePanelProps) {
    const { product, payment } = SUPPLY_TERMINAL_CONFIG;
    const canStage = selected && playerFeldspar >= payment.quantity;
    const canConfirm = exchangeState === "payment_staged" && machineStock > 0;
    const isSubmitting = exchangeState === "submitting";

    const stateBadge = () => {
        switch (exchangeState) {
            case "selected":
                return <Badge color="blue">Selected</Badge>;
            case "payment_staged":
                return <Badge color="green">Ready to confirm</Badge>;
            case "submitting":
                return <Badge color="orange">Submitting...</Badge>;
            case "completed":
                return <Badge color="green">Completed</Badge>;
            case "failed":
                return <Badge color="red">Failed</Badge>;
            default:
                return null;
        }
    };

    return (
        <Card>
            <Heading size="3">Purchase</Heading>
            <Flex direction="column" gap="2" mt="2">
                <Text size="2">
                    Selected: {selected ? `${product.name} x${product.quantity}` : "None"}
                </Text>
                <Text size="2">
                    Required: {payment.name} x{payment.quantity}
                </Text>
                <Flex gap="2" align="center">
                    <Text size="2">Status:</Text>
                    {stateBadge()}
                </Flex>
                <Flex gap="2" mt="2">
                    <Button
                        onClick={onStagePayment}
                        disabled={!canStage || exchangeState === "payment_staged" || isSubmitting}
                    >
                        Stage Payment
                    </Button>
                    <Button
                        onClick={onConfirmExchange}
                        disabled={!canConfirm || isSubmitting}
                        color="green"
                    >
                        Confirm Exchange
                    </Button>
                    <Button
                        onClick={onCancel}
                        disabled={exchangeState === "idle" || isSubmitting}
                        color="gray"
                    >
                        Cancel
                    </Button>
                </Flex>
            </Flex>
        </Card>
    );
}
