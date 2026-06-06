// App-level configuration. Tank calibration now lives on the backend; the app
// only needs to know where the backend is and how often to refresh.

export const DEFAULT_CONFIG = {
  // Base URL of the self-hosted backend (LAN IP + port).
  backendUrl: 'http://192.168.1.50:4000',

  // Fallback poll interval in ms (live updates arrive over WebSocket; this is
  // a safety net if the socket drops).
  refreshInterval: 30000,
};

export type AppConfig = typeof DEFAULT_CONFIG;
