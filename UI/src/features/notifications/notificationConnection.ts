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
    .configureLogging(LogLevel.Warning)
    .build();
