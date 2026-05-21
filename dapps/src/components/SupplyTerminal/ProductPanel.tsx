import { Card, Button, Text, Flex, Heading } from "@radix-ui/themes";
import { SUPPLY_TERMINAL_CONFIG } from "./config";

interface ProductPanelProps {
    stock: number;
    onSelect: () => void;
    selected: boolean;
    disabled: boolean;
}

export function ProductPanel({ stock, onSelect, selected, disabled }: ProductPanelProps) {
    const { product, payment } = SUPPLY_TERMINAL_CONFIG;
    return (
        <Card>
            <Heading size="3">{product.name}</Heading>
            <Flex direction="column" gap="1" mt="2">
                <Text size="2">Price: {payment.name} x{payment.quantity}</Text>
                <Text size="2">Stock: {stock}</Text>
            </Flex>
            <Button
                mt="3"
                onClick={onSelect}
                disabled={disabled || selected}
                variant={selected ? "outline" : "solid"}
            >
                {selected ? "Selected" : "Select"}
            </Button>
        </Card>
    );
}
