import { FileNode } from '../components/editor/types';
import { mockManifests } from './mockManifests';
import { ValuesScenario } from '../contexts/ValuesScenariosContext';

export function renderHelmTemplate(files: FileNode[], scenario?: ValuesScenario): FileNode[] {
  // In a real implementation, we would use the scenario's values to render the templates
  // For now, we'll just use the mock manifests
  return mockManifests.map((manifest, index) => {
    const name = index === 0 ? 'deployment-my-helm-chart.yaml' :
                index === 1 ? 'service-my-helm-chart.yaml' :
                'ingress-my-helm-chart.yaml';

    // Service manifest has an indentation error
    const hasError = name === 'service-my-helm-chart.yaml';
    
    return {
      name,
      type: 'file',
      path: name,
      content: manifest.content,
      hasError,
      errorCount: hasError ? 1 : 0,
      errorLine: hasError ? 12 : undefined
    };
  });
}