export const mockChartFiles: Record<string, string> = {
  'Chart.yaml': `apiVersion: v2
name: example-chart
description: A Helm chart for Kubernetes
type: application
version: 0.1.0
appVersion: "1.0.0"`,

  'values.yaml': `# Default values for example-chart
replicaCount: 1
image:
  repository: nginx
  tag: "1.16.0"
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 80`,

  'templates/deployment.yaml': `apiVersion: apps/v1
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
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.port }}
              protocol: TCP`,

  'templates/service.yaml': `apiVersion: v1
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
    {{- include "example-chart.selectorLabels" . | nindent 4 }}`,

  'templates/_helpers.tpl': `{{/*
Expand the name of the chart.
*/}}
{{- define "example-chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "example-chart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "example-chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "example-chart.labels" -}}
helm.sh/chart: {{ include "example-chart.chart" . }}
{{ include "example-chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "example-chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "example-chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}`
};