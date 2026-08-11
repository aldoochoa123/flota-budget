import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./index.css";

/**
 * En el preview de Freebuff, `convex dev` escribe VITE_CONVEX_URL con la URL local
 * (http://127.0.0.1:3210), que el navegador no puede alcanzar. Si detectamos esa
 * URL local, derivamos la URL proxy del workspace a partir de la URL actual
 * (https://<puerto>-<workspace>.daytonaproxy01.net → https://<puertoConvex>-<workspace>...).
 * En producción (URL de Convex Cloud) esta lógica nunca se activa.
 */
function resolveConvexUrl(envUrl: string): string {
  const m = envUrl.match(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/);
  if (m && typeof window !== "undefined") {
    const port = m[2] ? m[2].slice(1) : "3210";
    const host = window.location.hostname.match(/^\d+-(.+)$/);
    if (host) {
      const scheme = window.location.protocol === "https:" ? "https" : "http";
      return `${scheme}://${port}-${host[1]}`;
    }
  }
  return envUrl;
}

const rawConvexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexUrl = resolveConvexUrl(rawConvexUrl ?? "");

if (!convexUrl) {
  throw new Error(
    "Falta VITE_CONVEX_URL. Configúrala en .env.local o en las variables del entorno antes de iniciar.",
  );
}

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
