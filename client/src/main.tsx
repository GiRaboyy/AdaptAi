import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Validate critical environment variables on startup
if (!import.meta.env.VITE_SUPABASE_URL) {
  console.error('[ENV] Missing VITE_SUPABASE_URL - Supabase authentication will not work');
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.error('[ENV] Missing VITE_SUPABASE_ANON_KEY - Supabase authentication will not work');
}

// Log environment status in development
if (import.meta.env.DEV) {
  console.log('[ENV] Supabase configured:', !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY));
}

createRoot(document.getElementById("root")!).render(<App />);
