import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Confirmer from "./components/Confirmer";
import Toaster from "./components/Toaster";
import "./styles/index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <Confirmer />
    <Toaster />
  </StrictMode>
);
