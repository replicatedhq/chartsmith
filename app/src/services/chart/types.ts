export interface ChartMetadata {
  name: string;
  version: string;
  description: string;
}

export interface NewChartResponse {
  files: Record<string, string>;
}

export interface ChartService {
  createFromPrompt(prompt: string): Promise<NewChartResponse>;
  createFromUpload(file: File): Promise<NewChartResponse>;
  createFromReplicated(appId: string, chartId: string): Promise<NewChartResponse>;
}