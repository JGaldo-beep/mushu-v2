import React from "react";
import { MotionConfig } from "framer-motion";
import ReactDOM from "react-dom/client";
import { Overlay } from "./Overlay";
import { LanguageProvider } from "@/i18n";
import "@fontsource-variable/geist";
import "./overlay.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <LanguageProvider>
        <MotionConfig reducedMotion="user">
          <Overlay />
        </MotionConfig>
      </LanguageProvider>
    </React.StrictMode>,
  );
}
