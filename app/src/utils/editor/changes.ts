import { FileNode } from '../../types/files';
import { EditorTyper } from './typing';

export async function updateDeploymentWithTypingEffect(
  files: FileNode[],
  onContentUpdate: (content: string) => void,
  onFilesUpdate: (files: FileNode[]) => void,
  typerRef: { current: { abort: () => void } | null }
): Promise<{ content: string; files: FileNode[]; timestamp: string }> {
  const filePath = 'templates/deployment.yaml';
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
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.port }}
              protocol: TCP`;

  // Create typer instance
  const typer = new EditorTyper(newContent, onContentUpdate);
  typerRef.current = typer;
  
  try {
    // Start typing effect
    await typer.start();

    // Update files with new content after typing is complete
    const updatedFiles = files.map(f => 
      f.path === filePath ? { ...f, content: newContent } : f
    );

    onFilesUpdate(updatedFiles);

    return {
      content: newContent,
      files: updatedFiles,
      timestamp
    };
  } finally {
    typerRef.current = null;
  }
}