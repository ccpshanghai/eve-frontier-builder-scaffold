import { Callout, Button } from "@radix-ui/themes";
import { InfoCircledIcon, GearIcon } from "@radix-ui/react-icons";

interface OwnerControlsProps {
    isOwner: boolean;
    extensionAuthorized: boolean;
    onAuthorize: () => void;
    isAuthorizing: boolean;
    onConfigure: () => void;
}

export function OwnerControls({
    isOwner,
    extensionAuthorized,
    onAuthorize,
    isAuthorizing,
    onConfigure,
}: OwnerControlsProps) {
    if (!isOwner) return null;

    return (
        <>
            {!extensionAuthorized && (
                <Callout.Root color="orange" variant="surface" style={{ marginBottom: 8 }}>
                    <Callout.Icon>
                        <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text>
                        Extension not authorized — items cannot be moved.
                    </Callout.Text>
                    <Button
                        ml="auto"
                        size="1"
                        onClick={onAuthorize}
                        disabled={isAuthorizing}
                    >
                        {isAuthorizing ? "Authorizing..." : "Authorize Extension"}
                    </Button>
                </Callout.Root>
            )}
            <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 10 }}>
                <Button variant="soft" size="2" onClick={onConfigure}>
                    <GearIcon /> Configure
                </Button>
            </div>
        </>
    );
}
