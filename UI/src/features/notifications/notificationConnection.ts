import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { environment } from '../../environments/environment';

// Builds (does not start) a connection to the notifications hub.
// The JWT is supplied via accessTokenFactory; the server reads ?access_token=.
export const createNotificationConnection = (getToken: () => string | undefined): HubConnection =>
  new HubConnectionBuilder()
    .withUrl(`${environment.apiUrl}/hubs/notifications`, {
      accessTokenFactory: () => getToken() ?? '',
    })
    .withAutomaticReconnect()
    // The hub's server->client keep-alive ping does not survive the reverse
    // proxy, so an idle socket looks "silent" to the client even though it is
    // healthy and still delivers notifications. A real drop is detected
    // immediately by the socket close event, so we can safely raise the
    // silence tolerance to 5 minutes to avoid pointless idle reconnects, while
    // still pinging the server every 15s to keep the server side warm.
    .withServerTimeout(300000)
    .withKeepAliveInterval(15000)
    .configureLogging(LogLevel.Warning)
    .build();
