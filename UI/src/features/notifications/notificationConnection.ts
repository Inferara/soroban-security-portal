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
    // Be tolerant of quiet periods behind the reverse proxy: only treat the
    // connection as dead after 60s of silence (default is 30s), and ping the
    // server every 15s so the link stays warm even when no notifications flow.
    .withServerTimeout(60000)
    .withKeepAliveInterval(15000)
    .configureLogging(LogLevel.Warning)
    .build();
