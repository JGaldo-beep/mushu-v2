import React from "react";
import { MotionConfig } from "framer-motion";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LanguageProvider } from "./i18n";
import "./index.css";
import "@fontsource-variable/geist";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./styles/design-tokens.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </LanguageProvider>
  </React.StrictMode>,
);
