import { ChartService, NewChartResponse } from './types';
import { mockChartFiles } from '../../mocks/chartFiles';

export const mockChartService: ChartService = {
  async createFromPrompt(prompt: string): Promise<NewChartResponse> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { files: mockChartFiles };
  },

  async createFromUpload(file: File): Promise<NewChartResponse> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { files: mockChartFiles };
  },

  async createFromReplicated(appId: string, chartId: string): Promise<NewChartResponse> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { files: mockChartFiles };
  }
};