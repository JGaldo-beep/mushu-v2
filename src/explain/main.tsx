import React from "react";
import { MotionConfig } from "framer-motion";
import ReactDOM from "react-dom/client";
import { ExplainApp } from "./ExplainApp";
import { LanguageProvider } from "@/i18n";
import "@fontsource-variable/geist";
import "@/overlay/overlay.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <MotionConfig reducedMotion="user">
        <ExplainApp />
      </MotionConfig>
    </LanguageProvider>
  </React.StrictMode>,
);
