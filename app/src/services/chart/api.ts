import { ChartAPI, NewChartResponse, CreateFromPromptRequest, CreateFromReplicatedRequest } from './types';
import { config } from '../../config';

// Create a class for handling API requests
export class APIClient implements ChartAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiUrl;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'An error occurred while processing your request');
    }
    return response.json();
  }

  async createFromPrompt(prompt: string): Promise<NewChartResponse> {
    const payload: CreateFromPromptRequest = { prompt };
    const response = await fetch(`${this.baseUrl}/v1/new/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'include'
    });

    return this.handleResponse<NewChartResponse>(response);
  }

  async createFromUpload(file: File): Promise<NewChartResponse> {
    const formData = new FormData();
    formData.append('chart', file);

    const response = await fetch(`${this.baseUrl}/v1/new/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    return this.handleResponse<NewChartResponse>(response);
  }

  async createFromReplicated(appId: string, chartId: string): Promise<NewChartResponse> {
    const payload: CreateFromReplicatedRequest = { appId, chartId };
    const response = await fetch(`${this.baseUrl}/v1/new/replicated`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'include'
    });

    return this.handleResponse<NewChartResponse>(response);
  }
}

// Create and export a single instance
export const api = new APIClient();