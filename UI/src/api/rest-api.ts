import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { showError } from '../features/dialog-handler/dialog-handler';

class RestApi {
  private baseUrl: string;
  private requestConfig: AxiosRequestConfig;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.requestConfig = {
      headers: {
       'Content-Type': 'application/json',
       'Authorization': authToken,
      },
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
        const errorText = (reason.response?.data as { message?: string })?.message 
          ?? (reason.response?.data as string)
          ?? `Error: ${reason.message}`;
        if (ignoreError) {
          return {} as AxiosResponse<unknown, unknown>;
        }
        showError(errorText);
        throw new Error(`Failed to make RestApi call`);        
      })
    return response;
  }

}

export default RestApi;
