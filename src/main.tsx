import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installErrorTracking } from "./lib/installErrorTracking";

installErrorTracking();

createRoot(document.getElementById("root")!).render(<App />);
