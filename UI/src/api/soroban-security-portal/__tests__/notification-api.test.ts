import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationType } from '../models/notification';

// Mock RestApi so getRestClient() (private) returns a controllable stub.
// The api module calls: new RestApi(baseUrl, authHeader) then client.request(endpoint, method).
// Must be a class (constructor function) because getRestClient() uses `new RestApi(...)`.
const mockRequest = vi.fn();
vi.mock('../../rest-api', () => {
  const MockRestApi = function () { return { request: mockRequest }; };
  return { default: MockRestApi };
});

// Also mock environment + oidc storage so getRestClient doesn't throw
vi.mock('../../../environments/environment', () => ({
  environment: { apiUrl: 'http://localhost', clientId: 'test-client' },
}));

// Silence localStorage access inside getAccessToken
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: vi.fn().mockReturnValue(null) },
  writable: true,
});

// Import AFTER mocks are in place
import {
  getNotificationsCall,
  getUnreadCountCall,
  markNotificationReadCall,
  markAllNotificationsReadCall,
} from '../soroban-security-portal-api';

beforeEach(() => {
  mockRequest.mockReset();
  mockRequest.mockResolvedValue({ data: null, status: 200 });
});

describe('getNotificationsCall', () => {
  it('GETs api/v1/notifications with page when no type given', async () => {
    mockRequest.mockResolvedValue({ data: [], status: 200 });
    await getNotificationsCall();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [endpoint, method] = mockRequest.mock.calls[0];
    expect(method).toBe('GET');
    expect(endpoint).toContain('api/v1/notifications');
    expect(endpoint).toContain('page=1');
    expect(endpoint).not.toContain('type=');
  });

  it('includes type in querystring when provided', async () => {
    mockRequest.mockResolvedValue({ data: [], status: 200 });
    await getNotificationsCall(NotificationType.Mention, 2);
    const [endpoint] = mockRequest.mock.calls[0];
    expect(endpoint).toContain(`type=${NotificationType.Mention}`);
    expect(endpoint).toContain('page=2');
  });

  it('returns the data from the response', async () => {
    const notifications = [{ id: 1, isRead: false }];
    mockRequest.mockResolvedValue({ data: notifications, status: 200 });
    const result = await getNotificationsCall();
    expect(result).toEqual(notifications);
  });
});

describe('getUnreadCountCall', () => {
  it('GETs api/v1/notifications/unread-count', async () => {
    mockRequest.mockResolvedValue({ data: 5, status: 200 });
    const result = await getUnreadCountCall();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [endpoint, method] = mockRequest.mock.calls[0];
    expect(method).toBe('GET');
    expect(endpoint).toBe('api/v1/notifications/unread-count');
    expect(result).toBe(5);
  });
});

describe('markNotificationReadCall', () => {
  it('POSTs to api/v1/notifications/{id}/read', async () => {
    mockRequest.mockResolvedValue({ data: null, status: 200 });
    await markNotificationReadCall(42);
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [endpoint, method] = mockRequest.mock.calls[0];
    expect(method).toBe('POST');
    expect(endpoint).toBe('api/v1/notifications/42/read');
  });
});

describe('markAllNotificationsReadCall', () => {
  it('POSTs to api/v1/notifications/read-all', async () => {
    mockRequest.mockResolvedValue({ data: null, status: 200 });
    await markAllNotificationsReadCall();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [endpoint, method] = mockRequest.mock.calls[0];
    expect(method).toBe('POST');
    expect(endpoint).toBe('api/v1/notifications/read-all');
  });
});
