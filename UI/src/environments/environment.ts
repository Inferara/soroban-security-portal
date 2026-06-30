interface WindowEnv {
    BASE_PATH: string;
    API_URL: string;
    CLIENT_ID: string;
    GA_ID: string;
    DEVTOOLS_API_URL?: string;
}

declare global {
    interface Window {
        env: WindowEnv;
    }
}

// Base URL of the Dev Tools backend (soroban-ret-web). Configured at deploy time
// via env.js; falls back to the local dev service so `npm run dev` works out of the box.
const devToolsApiUrl = window.env.DEVTOOLS_API_URL && window.env.DEVTOOLS_API_URL.trim() !== ''
    ? window.env.DEVTOOLS_API_URL
    : 'http://localhost:8787/api/dev-tools';

export const environment = {
    basePath: window.env.BASE_PATH,
    apiUrl: window.env.API_URL,
    clientId: window.env.CLIENT_ID,
    gaId: window.env.GA_ID,
    devToolsApiUrl,
};
