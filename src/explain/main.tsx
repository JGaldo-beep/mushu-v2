import React from "react";
import ReactDOM from "react-dom/client";
import { ExplainApp } from "./ExplainApp";
import { LanguageProvider } from "@/i18n";
import "@/overlay/overlay.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <ExplainApp />
    </LanguageProvider>
  </React.StrictMode>,
);
