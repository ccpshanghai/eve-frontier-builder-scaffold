import { Card, Text, Flex, Heading, Badge } from "@radix-ui/themes";

interface MachinePanelProps {
    carbonWeaveStock: number;
    feldsparCrystalsRevenue: number;
    online: boolean;
    extensionAuthorized: boolean;
}

export function MachinePanel({
    carbonWeaveStock,
    feldsparCrystalsRevenue,
    online,
    extensionAuthorized,
}: MachinePanelProps) {
    return (
        <Card>
            <Heading size="3">Machine Storage</Heading>
            <Flex direction="column" gap="1" mt="2">
                <Text size="2">Carbon Weave Stock: {carbonWeaveStock}</Text>
                <Text size="2">Feldspar Crystals Revenue: {feldsparCrystalsRevenue}</Text>
                <Flex gap="2" mt="1">
                    <Badge color={online ? "green" : "red"}>
                        {online ? "Online" : "Offline"}
                    </Badge>
                    <Badge color={extensionAuthorized ? "green" : "orange"}>
                        {extensionAuthorized ? "Extension: Authorized" : "Extension: Not Authorized"}
                    </Badge>
                </Flex>
            </Flex>
        </Card>
    );
}
