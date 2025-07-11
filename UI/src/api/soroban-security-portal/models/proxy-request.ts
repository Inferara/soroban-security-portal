export class ProxyRequestItem {
    url: string = '';
    method: string = 'GET';
    body: string = '';
    contentType: string = 'application/json';
    headers: Record<string, string> = {};
}