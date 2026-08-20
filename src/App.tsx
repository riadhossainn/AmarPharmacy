import { useState } from "react";
import type { Screen } from "./lib/types";
import { StoreProvider } from "./lib/store";
import { ToastProvider } from "./components/ui";
import Shell from "./components/Shell";
import Dashboard from "./screens/Dashboard";
import POS from "./screens/POS";
import Returns from "./screens/Returns";
import Inventory from "./screens/Inventory";
import Customers from "./screens/Customers";

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");

  return (
    <StoreProvider>
      <ToastProvider>
        <Shell screen={screen} setScreen={setScreen}>
          <div className="h-full anim-fade" key={screen}>
            {screen === "dashboard" && <Dashboard />}
            {screen === "pos" && <POS />}
            {screen === "returns" && <Returns />}
            {screen === "inventory" && <Inventory />}
            {screen === "customers" && <Customers />}
          </div>
        </Shell>
      </ToastProvider>
    </StoreProvider>
  );
}
