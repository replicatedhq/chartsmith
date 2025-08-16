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
{{- if .Values.anthropic.apiKey }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.anthropic.existingSecret }}
{{- .Values.anthropic.existingSecret }}
{{- else }}
{{- fail "\n\nThis chart requires an ANTHROPIC_API_KEY. See README for instructions." }}
{{- end }}
{{- end }}

{{/*
Define GROQ_API_KEY
*/}}
{{- define "chartsmith.groqApiKey" -}}
{{- if .Values.groq.apiKey }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.groq.existingSecret }}
{{- .Values.groq.existingSecret }}
{{- else }}
{{- fail "\n\nThis chart requires an GROQ_API_KEY. See README for instructions." }}
{{- end }}
{{- end }}

{{/*
Define VOYAGE_API_KEY
*/}}
{{- define "chartsmith.voyageApiKey" -}}
{{- if .Values.voyage.apiKey }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.voyage.existingSecret }}
{{- .Values.voyage.existingSecret }}
{{- else }}
{{- fail "\n\nThis chart requires an VOYAGE_API_KEY. See README for instructions." }}
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
{{- fail "\n\nThis chart requires an GOOGLE_CLIENT_SECRET. See README for instructions." }}
{{- end }}
{{- end }}

{{/*
Define CHARTSMITH_CENTRIFUGO_API_KEY
*/}}
{{- define "chartsmith.centrifugoApiKey" -}}
{{- if .Values.centrifugo.apiKey }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.centrifugo.existingSecret }}
{{- .Values.centrifugo.existingSecret }}
{{- else }}
{{- fail "\n\nThis chart requires a CHARTSMITH_CENTRIFUGO_API_KEY. See README for instructions." }}
{{- end }}
{{- end }}

{{/*
Define CENTRIFUGO_TOKEN_HMAC_SECRET
*/}}
{{- define "chartsmith.centrifugoTokenHmacSecret" -}}
{{- if .Values.centrifugo.tokenHmacSecret }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.centrifugo.existingSecret }}
{{- .Values.centrifugo.existingSecret }}
{{- else }}
{{- fail "\n\nThis chart requires a CENTRIFUGO_TOKEN_HMAC_SECRET. See README for instructions." }}
{{- end }}
{{- end }}

{{/*
Define HMAC_SECRET
*/}}
{{- define "chartsmith.hmacSecret" -}}
{{- if .Values.hmac.secret }}
{{- include "chartsmith.fullname" . }}-secrets
{{- else if .Values.hmac.existingK8sSecret }}
{{- .Values.hmac.existingK8sSecret }}
{{- else }}
{{- fail "\n\nThis chart requires a HMAC_SECRET. See README for instructions." }}
{{- end }}
{{- end }}

{{/*
Define CHARTSMITH_PG_URI
*/}}
{{- define "chartsmith.pgUri" -}}
{{- $pgUri := .Values.postgresql.externalUri }}
{{- $pgEnabled := .Values.postgresql.enabled }}
{{- $pgCredentialsSet := and .Values.postgresql.credentials.username .Values.postgresql.credentials.password .Values.postgresql.credentials.database }}
{{- $pgExistingSecret := .Values.postgresql.credentials.existingSecret }}
{{- if not (or $pgUri $pgEnabled) }}
  {{- fail "\n\nThis chart requires either postgresql.externalUri, or postgresql.enabled=true. See README for instructions." }}
{{- end }}
- name: CHARTSMITH_PG_URI
{{- if $pgUri }}
  value: {{ $pgUri }}
{{- else if $pgEnabled }}
  {{- if not (or $pgCredentialsSet $pgExistingSecret) }}
    {{- fail "\n\nIf postgresql.enabled=true this chart requires postgresql credentials (as values or in an existing secret). See README for instructions." }}
  {{- end }}
  valueFrom:
    secretKeyRef:
      name: {{ if $pgCredentialsSet }}{{ include "chartsmith.fullname" . }}-secrets{{ else }}{{ $pgExistingSecret }}{{ end }}
      key: CHARTSMITH_PG_URI
{{- end }}
{{- end}}
