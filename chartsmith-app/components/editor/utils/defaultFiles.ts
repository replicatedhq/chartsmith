import { FileNode } from '../types';
import { addFilePaths } from './fileUtils';

const defaultContent = {
  'Chart.yaml': `apiVersion: v2
name: my-helm-chart
description: A Helm chart for Kubernetes
type: application
version: 0.1.0
appVersion: "1.0.0"`,
  'values.yaml': `# Default values for my-helm-chart
replicaCount: 1
image:
  repository: nginx
  tag: "1.16.0"
  pullPolicy: IfNotPresent`,
  'deployment.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "example-chart.fullname" . }}
  labels:
    {{- include "example-chart.labels" . | nindent 4 }}
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
              protocol: TCP`,
  'service.yaml': `apiVersion: v1
kind: Service
metadata:
  name: {{ include "example-chart.fullname" . }}
  labels:
    {{- include "example-chart.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}`,
  'ingress.yaml': `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "my-helm-chart.fullname" . }}
  labels:
    {{- include "my-helm-chart.labels" . | nindent 4 }}`,
  'NOTES.txt': `Thank you for installing {{ .Chart.Name }}.

Your release is named {{ .Release.Name }}.`,
  '.helmignore': `# Patterns to ignore when building packages.
*.tgz
.DS_Store
.git/
.gitignore
.bzr/
.bzrignore`
};

const files: FileNode[] = [
  {
    name: 'example-chart',
    type: 'folder',
    children: [
      { name: 'Chart.yaml', type: 'file', content: defaultContent['Chart.yaml'] },
      { name: 'values.yaml', type: 'file', content: defaultContent['values.yaml'] },
      {
        name: 'templates',
        type: 'folder',
        children: [
          { name: 'deployment.yaml', type: 'file', content: defaultContent['deployment.yaml'] },
          { name: 'service.yaml', type: 'file', content: defaultContent['service.yaml'] },
          { name: 'ingress.yaml', type: 'file', content: defaultContent['ingress.yaml'] },
          { name: 'NOTES.txt', type: 'file', content: defaultContent['NOTES.txt'] }
        ]
      },
      { name: 'charts', type: 'folder', children: [] },
      { name: '.helmignore', type: 'file', content: defaultContent['.helmignore'] }
    ]
  }
];

export const defaultFiles = addFilePaths(files);