import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// import React from "react"; // Supprimé car non utilisé directement pour JSX ou React API

createRoot(document.getElementById("root")!).render(<App />);