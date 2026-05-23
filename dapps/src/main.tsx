import React from "react";
import ReactDOM from "react-dom/client";
import "./main.css";

import { QueryClient } from "@tanstack/react-query";
import App from "./App.tsx";
import { Theme } from "@radix-ui/themes";
import { DappProvider } from "./providers/DappProvider.tsx";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme appearance="dark">
      <DappProvider queryClient={queryClient}>
        <App />
      </DappProvider>
    </Theme>
  </React.StrictMode>,
);
