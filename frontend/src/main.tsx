import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AuthRoot from "./AuthRoot";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthRoot />
  </StrictMode>
);
