import React from "react";
import ReactDOM from "react-dom/client";
import { AgentApp } from "./AgentApp";
import "@/overlay/overlay.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AgentApp />
  </React.StrictMode>,
);
