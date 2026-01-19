import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { showError } from '../features/dialog-handler/dialog-handler';

/**
 * Custom event name for authentication failures.
 * Listen for this event to handle session cleanup when API returns 401.
 */
export const AUTH_FAILURE_EVENT = 'auth:failure';

/**
 * Dispatch an authentication failure event.
 * This is used to notify the app that the session has expired.
 */
export const dispatchAuthFailure = (): void => {
  window.dispatchEvent(new CustomEvent(AUTH_FAILURE_EVENT));
};

class RestApi {
  private baseUrl: string;
  private requestConfig: AxiosRequestConfig;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Only add Authorization header if token is provided
    if (authToken) {
      headers['Authorization'] = authToken;
    }
    
    this.requestConfig = {
      headers,
    };
  }

  public async setContentType(contentType: string) {
    if (this.requestConfig.headers) {
      this.requestConfig.headers['Content-Type'] = contentType;
    }
  }

  public async request(endpoint: string, method: string = 'GET', data: unknown = undefined, ignoreError: boolean = false): Promise<AxiosResponse> {
    const url = `${this.baseUrl}/${endpoint}`;
    const isFormData = data instanceof FormData;
  
    // Clone requestConfig to avoid mutating shared config
    const config: AxiosRequestConfig = {
      ...this.requestConfig,
      url,
      method,
      data,
      headers: { ...(this.requestConfig?.headers || {}) },
    };
  
    // If it's FormData, remove Content-Type to let Axios auto-set it
    if (isFormData && config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type']; // just in case
    }
    const response = await axios
      .request(config)
      .catch((reason: AxiosError) => {
        const status = reason.response?.status;
        const errorText = (reason.response?.data as { message?: string })?.message 
          ?? (reason.response?.data as string)
          ?? `Error: ${reason.message}`;
        
        if (ignoreError) {
          return {} as AxiosResponse<unknown, unknown>;
        }

        // Handle authentication errors specifically
        if (status === 401) {
          const authError = 'Your session has expired. Please log in again.';
          showError(authError);
          // Dispatch event to trigger session cleanup
          dispatchAuthFailure();
          throw new Error(authError);
        } else if (status === 403) {
          const forbiddenError = 'Access denied. You do not have permission for this action.';
          showError(forbiddenError);
          throw new Error(forbiddenError);
        } else {
          showError(errorText);
          throw new Error(`API call failed: ${errorText} (Status: ${status || 'Network Error'})`);
        }        
      })
    return response;
  }

  public async downloadBlob(endpoint: string): Promise<Blob> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    const config: AxiosRequestConfig = {
      ...this.requestConfig,
      url,
      method: 'GET',
      responseType: 'blob',
      headers: { ...(this.requestConfig?.headers || {}) },
    };

    const response = await axios
      .request<Blob>(config)
      .catch((reason: AxiosError) => {
        const status = reason.response?.status;
        
        // Handle authentication errors specifically
        if (status === 401) {
          const authError = 'Your session has expired. Please log in again.';
          showError(authError);
          // Dispatch event to trigger session cleanup
          dispatchAuthFailure();
          throw new Error(authError);
        } else if (status === 403) {
          const forbiddenError = 'Access denied. You do not have permission for this action.';
          showError(forbiddenError);
          throw new Error(forbiddenError);
        } else {
          const errorText = `Download failed: ${reason.message}`;
          showError(errorText);
          throw new Error(errorText);
        }
      });
    
    return response.data;
  }

}

export default RestApi;
