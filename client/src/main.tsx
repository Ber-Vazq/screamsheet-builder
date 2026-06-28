import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// App is dark-first cyberpunk.
document.documentElement.classList.add("dark");

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
