import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { startLokPlaytime } from "./lib/lok/lokPlaytime";

startLokPlaytime();

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
