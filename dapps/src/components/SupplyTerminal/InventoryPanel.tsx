import { Card, Text, Flex, Heading } from "@radix-ui/themes";
import { SUPPLY_TERMINAL_CONFIG } from "./config";

interface InventoryPanelProps {
    feldsparCrystals: number;
    carbonWeave: number;
}

export function InventoryPanel({ feldsparCrystals, carbonWeave }: InventoryPanelProps) {
    const { payment, product } = SUPPLY_TERMINAL_CONFIG;
    return (
        <Card>
            <Heading size="3">Your Inventory</Heading>
            <Flex direction="column" gap="1" mt="2">
                <Text size="2">{payment.name}: {feldsparCrystals}</Text>
                <Text size="2">{product.name}: {carbonWeave}</Text>
            </Flex>
        </Card>
    );
}
