interface WindowEnv {
    BASE_PATH: string;
    API_URL: string;
    CLIENT_ID: string;
    GA_ID: string;
}

declare global {
    interface Window {
        env: WindowEnv;
    }
}

export const environment = {
    basePath: window.env.BASE_PATH,
    apiUrl: window.env.API_URL,
    clientId: window.env.CLIENT_ID,
    gaId: window.env.GA_ID,
};
