import { parseYAML } from './yaml';

export interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    labels?: Record<string, string>;
  };
}

export function parseK8sResource(content: string): K8sResource | null {
  const parsed = parseYAML(content);
  if (!parsed?.apiVersion || !parsed?.kind || !parsed?.metadata?.name) {
    return null;
  }
  return parsed as K8sResource;
}

export function getResourceName(resource: K8sResource): string {
  const kind = resource.kind.toLowerCase();
  const name = resource.metadata.name;
  return `${kind}-${name}.yaml`;
}