import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./index.css";

/**
 * Deployment de Convex Cloud (producción). No es secreto: es la URL pública del
 * backend en la nube. Sirve de respaldo para que el primer deploy funcione sin
 * variables de entorno, y como destino del preview del workspace.
 */
const CLOUD_CONVEX_URL = "https://artful-otter-336.convex.cloud";

/**
 * Resolución de la URL de Convex, en este orden:
 *  1. VITE_CONVEX_URL_CLOUD — override explícito (lo usa el preview para leer la
 *     nube; `convex dev` no lo pisa porque él solo escribe VITE_CONVEX_URL).
 *  2. VITE_CONVEX_URL — en el preview, `convex dev` escribe la URL local
 *     (http://127.0.0.1:3210), que el navegador no puede alcanzar; si la
 *     detectamos, la derivamos al proxy del workspace
 *     (https://<puerto>-<workspace>.daytonaproxy01.net).
 *  3. CLOUD_CONVEX_URL — respaldo final (builds de producción sin variables).
 */
function resolveConvexUrl(envUrl: string): string {
  const cloudOverride = import.meta.env.VITE_CONVEX_URL_CLOUD as string | undefined;
  if (cloudOverride) return cloudOverride;

  const m = envUrl.match(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/);
  if (m && typeof window !== "undefined") {
    const port = m[2] ? m[2].slice(1) : "3210";
    const host = window.location.hostname.match(/^\d+-(.+)$/);
    if (host) {
      const scheme = window.location.protocol === "https:" ? "https" : "http";
      return `${scheme}://${port}-${host[1]}`;
    }
  }
  return envUrl || CLOUD_CONVEX_URL;
}

const rawConvexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexUrl = resolveConvexUrl(rawConvexUrl ?? "");

const convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConvexProvider>
  </StrictMode>,
);
