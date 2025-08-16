{{/*
Expand the name of the chart.
*/}}
{{- define "chartsmith.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "chartsmith.fullname" -}}
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
{{- define "chartsmith.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "chartsmith.labels" -}}
helm.sh/chart: {{ include "chartsmith.chart" . }}
{{ include "chartsmith.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "chartsmith.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chartsmith.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: {{ .Values.component }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "chartsmith.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "chartsmith.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Define CHARTSMITH_ANTHROPIC_API_KEY
*/}}
{{- define "chartsmith.anthropicApiKey" -}}
{{- if .Values.anthropic.apiKey }}
name: {{ include "chartsmith.fullname" . }}-secrets
key: ANTHROPIC_API_KEY
{{- else if .Values.anthropic.existingSecret }}
name: {{ .Values.anthropic.existingSecret }}
key: {{ .Values.anthropic.existingSecretKey | default "api-key" }}
{{- else }}
{{- fail "\n\nThis chart requires an ANTHROPIC_API_KEY. See README for instructions." }}
{{- end }}
{{- end }}
