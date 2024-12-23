import { HelmService, ValidationResult, ChartMetadata } from './types';
import { FileNode, ValuesScenario } from '../../components/editor/types';
import { config } from '../../config';

export const realApi: HelmService = {
  async renderTemplate(files: FileNode[], scenario?: ValuesScenario): Promise<FileNode[]> {
    const response = await fetch(`${config.apiUrl}/helm/template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: files.map(f => ({
          path: f.path,
          content: f.content
        })),
        values: scenario?.values
      })
    });

    if (!response.ok) {
      throw new Error('Failed to render templates');
    }

    return response.json();
  },

  async validateChart(files: FileNode[]): Promise<ValidationResult[]> {
    const response = await fetch(`${config.apiUrl}/helm/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: files.map(f => ({
          path: f.path,
          content: f.content
        }))
      })
    });

    if (!response.ok) {
      throw new Error('Failed to validate chart');
    }

    return response.json();
  },

  async getChartMetadata(files: FileNode[]): Promise<ChartMetadata> {
    const response = await fetch(`${config.apiUrl}/helm/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: files.map(f => ({
          path: f.path,
          content: f.content
        }))
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get chart metadata');
    }

    return response.json();
  }
};