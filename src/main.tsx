import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RendererApp } from "./components/RendererApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RendererApp />
  </StrictMode>,
);
