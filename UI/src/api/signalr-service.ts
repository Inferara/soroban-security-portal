import * as signalR from "@microsoft/signalr";

class SignalRService {
    private connection: signalR.HubConnection | null = null;
    private tokenProvider: (() => Promise<string | null>) | null = null;

    private connectionPromise: Promise<void> | null = null;

    public setTokenProvider(provider: () => Promise<string | null>) {
        this.tokenProvider = provider;
    }

    public async startConnection(hubUrl: string): Promise<void> {
        if (this.connection?.state === signalR.HubConnectionState.Connected) {
            return;
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = (async () => {
            this.connection = new signalR.HubConnectionBuilder()
                .withUrl(hubUrl, {
                    accessTokenFactory: async () => {
                        if (this.tokenProvider) {
                            const token = await this.tokenProvider();
                            return token || "";
                        }
                        return "";
                    }
                })
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Information)
                .build();

            this.connection.onreconnecting((error) => {
                console.warn(`SignalR Connection lost. Reconnecting. Error: ${error}`);
            });

            this.connection.onreconnected((connectionId) => {
                console.log(`SignalR Connection reestablished. Id: ${connectionId}`);
            });

            this.connection.onclose((error) => {
                console.error(`SignalR Connection closed. Error: ${error}`);
                this.connectionPromise = null;
            });

            try {
                await this.connection.start();
                console.log("SignalR Connected.");
            } catch (err) {
                console.error("SignalR Connection request failed: ", err);
                this.connectionPromise = null;
                // Retry logic could be added here or handled by the caller/hook polling
                throw err;
            }
        })();

        return this.connectionPromise;
    }

    public on(methodName: string, newMethod: (...args: any[]) => void) {
        if (!this.connection) {
            console.warn("SignalR connection not initialized, cannot register handler for " + methodName);
            return;
        }
        this.connection.on(methodName, newMethod);
    }

    public off(methodName: string, method: (...args: any[]) => void) {
        if (!this.connection) return;
        this.connection.off(methodName, method);
    }

    public async invoke(methodName: string, ...args: any[]) {
        if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
            return await this.connection.invoke(methodName, ...args);
        }
        throw new Error("SignalR connection is not established.");
    }

    public getConnectionState(): signalR.HubConnectionState {
        return this.connection?.state ?? signalR.HubConnectionState.Disconnected;
    }
}

export const signalRService = new SignalRService();
