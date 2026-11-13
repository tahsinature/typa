import React from "react";
import ReactDOM from "react-dom/client";
import "allotment/dist/style.css";
import "./styles/globals.css";

import { App } from "./App";
import { syncNativePreferences } from "./lib/preferences";

void syncNativePreferences();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
