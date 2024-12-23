import { FileNode } from '../components/editor/types';

export async function updateDeploymentWithTimestamp(
  files: FileNode[],
  onContentUpdate: (content: string) => void,
  onFilesUpdate: (files: FileNode[]) => void
): Promise<{ content: string; files: FileNode[]; timestamp: string }> {
  const filePath = 'example-chart/templates/deployment.yaml';
  const timestamp = new Date().toISOString();
  
  const newContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "example-chart.fullname" . }}
  labels:
    {{- include "example-chart.labels" . | nindent 4 }}
  annotations:
    chartsmith.replicated.com/last-modified: "${timestamp}"
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "example-chart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "example-chart.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - name: http
              containerPort: {{ .Values.service.port }}
              protocol: TCP`;

  // Update content immediately
  onContentUpdate(newContent);

  // Update files with new content
  const updatedFiles = files.map(f => 
    f.path === filePath ? { ...f, content: newContent } : f
  );

  onFilesUpdate(updatedFiles);

  return {
    content: newContent,
    files: updatedFiles,
    timestamp
  };
}