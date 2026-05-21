import { Card, Text, Flex, Heading, ScrollArea } from "@radix-ui/themes";
import { ExchangeEvent } from "./types";

interface EventLogProps {
    events: ExchangeEvent[];
}

export function EventLog({ events }: EventLogProps) {
    if (events.length === 0) return null;

    return (
        <Card>
            <Heading size="3">Event Log</Heading>
            <ScrollArea style={{ maxHeight: 200 }} mt="2">
                <Flex direction="column" gap="1">
                    {events.map((event, i) => (
                        <Text key={i} size="1" color={event.type === "chain" ? "green" : "gray"}>
                            &gt; {event.message}
                            {event.digest && ` — ${event.digest.slice(0, 10)}...`}
                        </Text>
                    ))}
                </Flex>
            </ScrollArea>
        </Card>
    );
}
