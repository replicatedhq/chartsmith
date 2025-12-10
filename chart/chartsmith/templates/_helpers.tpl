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
Define ANTHROPIC_API_KEY
*/}}
{{- define "chartsmith.anthropicApiKey" -}}
{{- $apiKey := .Values.anthropic.apiKey | default "development-anthropic-api-key" }}
{{- if ne .Values.anthropic.apiKey "" }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.anthropic.existingSecret }}
{{- .Values.anthropic.existingSecret }}
{{- else }}
{{- include "chartsmith.fullname" . }}-secrets
{{- end }}
{{- end }}

{{/*
Define GROQ_API_KEY
*/}}
{{- define "chartsmith.groqApiKey" -}}
{{- $apiKey := .Values.groq.apiKey | default "development-groq-api-key" }}
{{- if ne .Values.groq.apiKey "" }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.groq.existingSecret }}
{{- .Values.groq.existingSecret }}
{{- else }}
{{- include "chartsmith.fullname" . }}-secrets
{{- end }}
{{- end }}

{{/*
Define VOYAGE_API_KEY
*/}}
{{- define "chartsmith.voyageApiKey" -}}
{{- $apiKey := .Values.voyage.apiKey | default "development-voyage-api-key" }}
{{- if ne .Values.voyage.apiKey "" }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.voyage.existingSecret }}
{{- .Values.voyage.existingSecret }}
{{- else }}
{{- include "chartsmith.fullname" . }}-secrets
{{- end }}
{{- end }}

{{/*
Define GOOGLE_CLIENT_SECRET
*/}}
{{- define "chartsmith.googleClientSecret" -}}
{{- if .Values.auth.google.clientSecret }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.auth.google.existingSecret }}
{{- .Values.auth.google.existingSecret }}
{{- else }}
{{- include "chartsmith.fullname" . }}-secrets
{{- end }}
{{- end }}

{{/*
Define CHARTSMITH_CENTRIFUGO_API_KEY
*/}}
{{- define "chartsmith.centrifugoApiKey" -}}
{{- $apiKey := .Values.centrifugo.apiKey | default "development-centrifugo-api-key" }}
{{- if ne .Values.centrifugo.apiKey "" }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.centrifugo.existingSecret }}
{{- .Values.centrifugo.existingSecret }}
{{- else }}
{{- include "chartsmith.fullname" . }}-secrets
{{- end }}
{{- end }}

{{/*
Define CENTRIFUGO_TOKEN_HMAC_SECRET
*/}}
{{- define "chartsmith.centrifugoTokenHmacSecret" -}}
{{- $secret := .Values.centrifugo.tokenHmacSecret | default "development-centrifugo-token-hmac-secret" }}
{{- if ne .Values.centrifugo.tokenHmacSecret "" }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.centrifugo.existingSecret }}
{{- .Values.centrifugo.existingSecret }}
{{- else }}
{{- include "chartsmith.fullname" . }}-secrets
{{- end }}
{{- end }}

{{/*
Define HMAC_SECRET
*/}}
{{- define "chartsmith.hmacSecret" -}}
{{- $secret := .Values.hmac.secret | default "development-hmac-secret-32-characters-long" }}
{{- if ne .Values.hmac.secret "" }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.hmac.existingK8sSecret }}
{{- .Values.hmac.existingK8sSecret }}
{{- else }}
{{- include "chartsmith.fullname" . }}-secrets
{{- end }}
{{- end }}

{{/*
Define CHARTSMITH_PG_URI
*/}}
{{- define "chartsmith.pgUri" -}}
{{- $pgUri := .Values.postgresql.externalUri }}
{{- $pgEnabled := .Values.postgresql.enabled }}
{{- $pgUsername := .Values.postgresql.credentials.username | default "chartsmith" }}
{{- $pgPassword := .Values.postgresql.credentials.password | default "development-password" }}
{{- $pgDatabase := .Values.postgresql.credentials.database | default "chartsmith" }}
{{- $pgCredentialsSet := and .Values.postgresql.credentials.username .Values.postgresql.credentials.password .Values.postgresql.credentials.database }}
{{- $pgExistingSecret := .Values.postgresql.credentials.existingSecret }}
{{- if not (or $pgUri $pgEnabled) }}
  {{- fail "\n\nThis chart requires either postgresql.externalUri, or postgresql.enabled=true. See README for instructions." }}
{{- end }}
{{- if $pgUri }}
value: {{ $pgUri }}
{{- else if $pgEnabled }}
valueFrom:
  secretKeyRef:
    name: {{ if $pgExistingSecret }}{{ $pgExistingSecret }}{{ else }}{{ include "chartsmith.fullname" . }}-secrets{{ end }}
    key: CHARTSMITH_PG_URI
{{- end }}
{{- end}}
