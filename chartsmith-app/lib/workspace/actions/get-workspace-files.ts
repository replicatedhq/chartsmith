"use server"

import { FileNode } from "@/lib/types/files";

export async function getInitialWorkspaceFiles(): Promise<FileNode[]> {
  const staticFiles: FileNode[] = [
    {
      name: 'Chart.yaml',
      type: 'file',
      path: 'Chart.yaml',
      content: `apiVersion: v2
name: my-helm-chart
description: A Helm chart for Kubernetes
type: application
version: 0.1.0
appVersion: "1.0.0"`
    },
    {
      name: 'values.yaml',
      type: 'file',
      path: 'values.yaml',
      content: `# Default values for my-helm-chart
replicaCount: 1
image:
  repository: nginx
  tag: "1.16.0"
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 80`
    },
    {
      name: 'deployment.yaml',
      type: 'file',
      path: 'templates/deployment.yaml',
      content: `apiVersion: apps/v1
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
              protocol: TCP`
    },
    {
      name: 'service.yaml',
      type: 'file',
      path: 'templates/service.yaml',
      content: `apiVersion: v1
kind: Service
metadata:
  name: {{ include "example-chart.fullname" . }}
  labels:
    {{- include "example-chart.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "example-chart.selectorLabels" . | nindent 4 }`
    },
    {
      name: 'ingress.yaml',
      type: 'file',
      path: 'templates/ingress.yaml',
      content: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "my-helm-chart.fullname" . }}
  labels:
    {{- include "my-helm-chart.labels" . | nindent 4 }}`
    }
  ];

  return staticFiles;
}
