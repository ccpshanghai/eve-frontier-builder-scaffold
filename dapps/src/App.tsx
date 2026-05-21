import { Box, Flex, Heading } from "@radix-ui/themes";
import { SupplyTerminal } from "./components/SupplyTerminal/SupplyTerminal";
import { abbreviateAddress, useConnection } from "@evefrontier/dapp-kit";
import { useCurrentAccount } from "@mysten/dapp-kit-react";

function App() {
  const { handleConnect, handleDisconnect } = useConnection();
  const account = useCurrentAccount();

  return (
    <Box style={{ padding: "20px" }}>
      <Flex
        position="sticky"
        px="4"
        py="2"
        direction="row"
        style={{
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Heading>EVE Frontier dApp — Supply Terminal</Heading>

        <button
          onClick={() =>
            account?.address ? handleDisconnect() : handleConnect()
          }
        >
          {account ? abbreviateAddress(account?.address) : "Connect Wallet"}
        </button>
      </Flex>

      <SupplyTerminal />
    </Box>
  );
}

export default App;
