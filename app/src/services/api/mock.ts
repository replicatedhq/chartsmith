import { HelmService, ValidationResult, ChartMetadata } from './types';
import { FileNode, ValuesScenario } from '../../types/files';
import { mockManifests } from '../../mocks/manifests';
import { parseK8sResource, getResourceName } from '../../utils/k8s';
import { validateYAMLIndentation } from '../../utils/yaml';

export const mockApi: HelmService = {
  async renderTemplate(files: FileNode[], scenario?: ValuesScenario): Promise<FileNode[]> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 500));

    return mockManifests.map(manifest => {
      const resource = parseK8sResource(manifest.content);
      if (!resource) return null;

      const name = getResourceName(resource);
      const errors = validateYAMLIndentation(manifest.content);

      return {
        name,
        type: 'file',
        path: name,
        content: manifest.content,
        hasError: errors.length > 0,
        errorCount: errors.length,
        errorLine: errors[0]?.line
      };
    }).filter(Boolean) as FileNode[];
  },

  async validateChart(files: FileNode[]): Promise<ValidationResult[]> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 300));

    // Return mock validation results
    return [
      {
        path: 'service-my-helm-chart.yaml',
        line: 12,
        message: 'Incorrect indentation. Expected 2 spaces.',
        severity: 'error'
      }
    ];
  },

  async getChartMetadata(files: FileNode[]): Promise<ChartMetadata> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      name: 'my-helm-chart',
      version: '0.1.0',
      description: 'A Helm chart for Kubernetes',
      maintainers: ['user@example.com']
    };
  }
};