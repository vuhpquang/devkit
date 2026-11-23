import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Launcher } from "./app/LauncherWindow";
import "./index.css";

// The ⌥Space launcher window loads index.html?launcher (src-tauri/tauri.conf.json).
const isLauncher = new URLSearchParams(location.search).has("launcher");
if (isLauncher) document.documentElement.classList.add("launcher");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isLauncher ? <Launcher /> : <App />}
  </React.StrictMode>,
);
