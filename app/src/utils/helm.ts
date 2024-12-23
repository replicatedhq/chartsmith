import { FileNode } from '../components/editor/types';
import { parseK8sResource, getResourceName } from './k8s';
import { validateYAMLIndentation } from './yaml';
import { mockManifests } from './mockManifests';

export function renderHelmTemplate(files: FileNode[]): FileNode[] {
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
      errors
    };
  }).filter(Boolean) as FileNode[];