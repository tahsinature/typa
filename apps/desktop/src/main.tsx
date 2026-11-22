import React from "react";
import ReactDOM from "react-dom/client";
import "allotment/dist/style.css";
import "./styles/globals.css";

import { App } from "./App";
import { syncNativePreferences } from "./lib/preferences";

// Suppress the webview menu without stopping custom context-menu handlers.
const preventDefaultContextMenu = (event: MouseEvent) => event.preventDefault();
document.addEventListener("contextmenu", preventDefaultContextMenu);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.removeEventListener("contextmenu", preventDefaultContextMenu);
  });
}

void syncNativePreferences();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
