INSERT INTO chartsmith_user (id, email, name, image_url, created_at, last_login_at, last_active_at, replicated_token) VALUES ('user0001', 'test001@chartsmith.ai', 'Test User 001', 'https://lh3.googleusercontent.com/a/ACg8ocKMCd7IIMaIYf6KpVsJ-lHAkYoVWBB8OjBwgsKks7eeHktfcw=s96-c', '2025-01-08 04:27:33.626387', '2025-01-08 04:27:33.626387', '2025-01-08 04:27:33.626387', null);

INSERT INTO workspace (id, created_at, last_updated_at, name, created_by_user_id, created_type, current_revision_number) VALUES ('workspace0001', '2025-01-11 01:03:30.500928', '2025-01-11 01:03:30.500928', 'new workspace', 'user0001', 'prompt', 0);

INSERT INTO workspace_revision (workspace_id, revision_number, created_at, chat_message_id, created_by_user_id, created_type, is_complete) VALUES ('workspace0001', 0, '2025-01-11 01:03:30.500928', NULL, 'chat0001', 'manual', true);

INSERT INTO workspace_chat (id, workspace_id, is_initial_message, created_at, sent_by, prompt, response, is_complete, files_sent, is_applied, is_applying, is_ignored) VALUES ('chat0001', 'workspace0001', true, '2025-01-11 01:03:30.521835', 'GTCLovn7P4A1', 'wordpress', 'For a WordPress deployment, I''ll create a chart to handle:

A StatefulSet for WordPress with a persistent volume to store media and uploads. This ensures data persistence across pod restarts and maintains a stable identity.

A Deployment for MySQL database with persistent storage for the database files.

Services to expose both WordPress and MySQL internally, with WordPress potentially accessible externally.

ConfigMaps to manage WordPress configurations and environment variables.

Secrets to store MySQL credentials and WordPress authentication keys securely.

An optional Ingress resource to provide external access to WordPress via a domain name.

All resources will be parameterized through values.yaml, allowing customization of:
- Image versions
- Resource limits
- Storage sizes
- Database credentials
- WordPress configurations
- Service types
- Ingress settings

Common labels and metadata will be managed through _helpers.tpl for consistency.

Would you like me to proceed with creating these resources?', true, NULL, false, false, false);

INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('kMw2sFzHS44M', 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/templates/serviceaccount.yaml', 0, '2025-01-11 01:03:30.500928', '2025-01-11 01:03:30.500928', '{{- if .Values.serviceAccount.create -}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "bootstrap-chart.serviceAccountName" . }}
  labels:
    {{- include "bootstrap-chart.labels" . | nindent 4 }}
  {{- with .Values.serviceAccount.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
automountServiceAccountToken: {{ .Values.serviceAccount.automount }}
{{- end }}
', 'serviceaccount.yaml');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('kMw2sFzHS44M', 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/values.yaml', 0, '2025-01-11 01:03:30.500928', '2025-01-11 01:03:30.500928', '# Default values for bootstrap-chart.
# This is a YAML-formatted file.
# Declare variables to be passed into your templates.

# This will set the replicaset count more information can be found here: https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/
replicaCount: 1

# This sets the container image more information can be found here: https://kubernetes.io/docs/concepts/containers/images/
image:
  repository: nginx
  # This sets the pull policy for images.
  pullPolicy: IfNotPresent
  # Overrides the image tag whose default is the chart appVersion.
  tag: ""

# This is for the secretes for pulling an image from a private repository more information can be found here: https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/
imagePullSecrets: []
# This is to override the chart name.
nameOverride: ""
fullnameOverride: ""

#This section builds out the service account more information can be found here: https://kubernetes.io/docs/concepts/security/service-accounts/
serviceAccount:
  # Specifies whether a service account should be created
  create: true
  # Automatically mount a ServiceAccount''s API credentials?
  automount: true
  # Annotations to add to the service account
  annotations: {}
  # The name of the service account to use.
  # If not set and create is true, a name is generated using the fullname template
  name: ""

# This is for setting Kubernetes Annotations to a Pod.
# For more information checkout: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/
podAnnotations: {}
# This is for setting Kubernetes Labels to a Pod.
# For more information checkout: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/
podLabels: {}

podSecurityContext: {}
  # fsGroup: 2000

securityContext: {}
  # capabilities:
  #   drop:
  #   - ALL
  # readOnlyRootFilesystem: true
  # runAsNonRoot: true
  # runAsUser: 1000

# This is for setting up a service more information can be found here: https://kubernetes.io/docs/concepts/services-networking/service/
service:
  # This sets the service type more information can be found here: https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services-service-types
  type: ClusterIP
  # This sets the ports more information can be found here: https://kubernetes.io/docs/concepts/services-networking/service/#field-spec-ports
  port: 80

# This block is for setting up the ingress for more information can be found here: https://kubernetes.io/docs/concepts/services-networking/ingress/
ingress:
  enabled: false
  className: ""
  annotations: {}
    # kubernetes.io/ingress.class: nginx
    # kubernetes.io/tls-acme: "true"
  hosts:
    - host: chart-example.local
      paths:
        - path: /
          pathType: ImplementationSpecific
  tls: []
  #  - secretName: chart-example-tls
  #    hosts:
  #      - chart-example.local

resources: {}
  # We usually recommend not to specify default resources and to leave this as a conscious
  # choice for the user. This also increases chances charts run on environments with little
  # resources, such as Minikube. If you do want to specify resources, uncomment the following
  # lines, adjust them as necessary, and remove the curly braces after ''resources:''.
  # limits:
  #   cpu: 100m
  #   memory: 128Mi
  # requests:
  #   cpu: 100m
  #   memory: 128Mi

# This is to setup the liveness and readiness probes more information can be found here: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
livenessProbe:
  httpGet:
    path: /
    port: http
readinessProbe:
  httpGet:
    path: /
    port: http

#This section is for setting up autoscaling more information can be found here: https://kubernetes.io/docs/concepts/workloads/autoscaling/
autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80
  # targetMemoryUtilizationPercentage: 80

# Additional volumes on the output Deployment definition.
volumes: []
# - name: foo
#   secret:
#     secretName: mysecret
#     optional: false

# Additional volumeMounts on the output Deployment definition.
volumeMounts: []
# - name: foo
#   mountPath: "/etc/foo"
#   readOnly: true

nodeSelector: {}

tolerations: []

affinity: {}
', 'values.yaml');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('kMw2sFzHS44M', 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/.helmignore', 0, '2025-01-11 01:03:30.500928', '2025-01-11 01:03:30.500928', '# Patterns to ignore when building packages.
# This supports shell glob matching, relative path matching, and
# negation (prefixed with !). Only one pattern per line.
.DS_Store
# Common VCS dirs
.git/
.gitignore
.bzr/
.bzrignore
.hg/
.hgignore
.svn/
# Common backup files
*.swp
*.bak
*.tmp
*.orig
*~
# Various IDEs
.project
.idea/
*.tmproj
.vscode/
', '.helmignore');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('kMw2sFzHS44M', 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/Chart.yaml', 0, '2025-01-11 01:03:30.500928', '2025-01-11 01:03:30.500928', 'apiVersion: v2
name: bootstrap-chart
description: A Helm chart for Kubernetes

# A chart can be either an ''application'' or a ''library'' chart.
#
# Application charts are a collection of templates that can be packaged into versioned archives
# to be deployed.
#
# Library charts provide useful utilities or functions for the chart developer. They''re included as
# a dependency of application charts to inject those utilities and functions into the rendering
# pipeline. Library charts do not define any templates and therefore cannot be deployed.
type: application

# This is the chart version. This version number should be incremented each time you make changes
# to the chart and its templates, including the app version.
# Versions are expected to follow Semantic Versioning (https://semver.org/)
version: 0.0.0

# This is the version number of the application being deployed. This version number should be
# incremented each time you make changes to the application. Versions are not expected to
# follow Semantic Versioning. They should reflect the version the application is using.
# It is recommended to use it with quotes.
appVersion: "0.0.0"

dependencies:
- name: replicated
  repository: oci://registry.replicated.com/library
  version: 1.0.0-beta.32
', 'Chart.yaml');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('kMw2sFzHS44M', 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/templates/NOTES.txt', 0, '2025-01-11 01:03:30.500928', '2025-01-11 01:03:30.500928', 'You''ve installed the app.
', 'NOTES.txt');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('kMw2sFzHS44M', 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/templates/_helpers.tpl', 0, '2025-01-11 01:03:30.500928', '2025-01-11 01:03:30.500928', '{{/*
Expand the name of the chart.
*/}}
{{- define "bootstrap-chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "bootstrap-chart.fullname" -}}
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
{{- define "bootstrap-chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "bootstrap-chart.labels" -}}
helm.sh/chart: {{ include "bootstrap-chart.chart" . }}
{{ include "bootstrap-chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "bootstrap-chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "bootstrap-chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "bootstrap-chart.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "bootstrap-chart.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
', '_helpers.tpl');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('kMw2sFzHS44M', 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/templates/service.yaml', 0, '2025-01-11 01:03:30.500928', '2025-01-11 01:03:30.500928', 'apiVersion: v1
kind: Service
metadata:
  name: {{ include "bootstrap-chart.fullname" . }}
  labels:
    {{- include "bootstrap-chart.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "bootstrap-chart.selectorLabels" . | nindent 4 }}
', 'service.yaml');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('workspace0001', 'Chart.yaml', 1, '2025-01-11 01:03:36.014264', '2025-01-11 01:03:36.014264', 'apiVersion: v2
name: wordpress
description: A Helm chart for WordPress with MySQL
type: application
version: 0.1.0
appVersion: "6.4.1"

dependencies:
- name: replicated
  repository: oci://registry.replicated.com/library
  version: 1.0.0-beta.32', 'Chart.yaml');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('workspace0001', 'values.yaml', 1, '2025-01-11 01:03:36.014264', '2025-01-11 01:03:36.014264', '# WordPress Application Configuration
wordpress:
  # Image configuration for WordPress
  image:
    # Repository path for the image
    repository: proxy.replicated.com/appslug
    # Image name without repository and tag
    name: wordpress
    # Image tag version
    tag: "6.4.1-apache"
    # Image pull policy
    pullPolicy: IfNotPresent

  # Image pull secrets configuration
  imagePullSecrets:
    - name: replicatedsecret

  # Service configuration
  service:
    type: ClusterIP
    port: 80

  # Storage configuration for WordPress
  persistence:
    enabled: true
    size: 10Gi
    storageClass: ""

  # Resource limits and requests
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi

# MySQL Database Configuration
mysql:
  # Image configuration for MySQL
  image:
    repository: proxy.replicated.com/appslug
    name: mysql
    tag: "8.0"
    pullPolicy: IfNotPresent

  # Service configuration
  service:
    port: 3306

  # Storage configuration for MySQL
  persistence:
    enabled: true
    size: 8Gi
    storageClass: ""

  # Resource configuration
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi

# Ingress Configuration
ingress:
  enabled: false
  className: "nginx"
  annotations: {}
  hosts:
    - host: wordpress.local
      paths:
        - path: /
          pathType: Prefix

# Global configurations
serviceAccount:
  create: true
  automount: true
  annotations: {}
  name: ""', 'values.yaml');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('workspace0001', 'templates/_helpers.tpl', 1, '2025-01-11 01:03:36.014264', '2025-01-11 01:03:36.014264', '{{/*
Expand the name of the chart.
*/}}
{{- define "wordpress.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "wordpress.fullname" -}}
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
{{- define "wordpress.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "wordpress.labels" -}}
helm.sh/chart: {{ include "wordpress.chart" . }}
{{ include "wordpress.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "wordpress.selectorLabels" -}}
app.kubernetes.io/name: {{ include "wordpress.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "wordpress.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "wordpress.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}', '_helpers.tpl');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('workspace0001', 'templates/wordpress-deployment.yaml', 1, '2025-01-11 01:03:36.014264', '2025-01-11 01:03:36.014264', 'apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "wordpress.fullname" . }}-wordpress
  labels:
    {{- include "wordpress.labels" . | nindent 4 }}
    app.kubernetes.io/component: wordpress
spec:
  replicas: 1
  selector:
    matchLabels:
      {{- include "wordpress.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: wordpress
  template:
    metadata:
      labels:
        {{- include "wordpress.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: wordpress
    spec:
      {{- with .Values.wordpress.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: wordpress
          image: "{{ .Values.wordpress.image.repository }}/{{ .Values.wordpress.image.name }}:{{ .Values.wordpress.image.tag }}"
          imagePullPolicy: {{ .Values.wordpress.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
          volumeMounts:
            - name: wordpress-data
              mountPath: /var/www/html
          resources:
            {{- toYaml .Values.wordpress.resources | nindent 12 }}
      volumes:
        - name: wordpress-data
          persistentVolumeClaim:
            claimName: {{ include "wordpress.fullname" . }}-wordpress', 'wordpress-deployment.yaml');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('workspace0001', 'templates/wordpress-pvc.yaml', 1, '2025-01-11 01:03:36.014264', '2025-01-11 01:03:36.014264', 'apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "wordpress.fullname" . }}-wordpress
  labels:
    {{- include "wordpress.labels" . | nindent 4 }}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: {{ .Values.wordpress.persistence.size }}
  {{- if .Values.wordpress.persistence.storageClass }}
  storageClassName: {{ .Values.wordpress.persistence.storageClass }}
  {{- end }}', 'wordpress-pvc.yaml');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('workspace0001', 'templates/wordpress-service.yaml', 1, '2025-01-11 01:03:36.014264', '2025-01-11 01:03:36.014264', 'apiVersion: v1
kind: Service
metadata:
  name: {{ include "wordpress.fullname" . }}-wordpress
  labels:
    {{- include "wordpress.labels" . | nindent 4 }}
    app.kubernetes.io/component: wordpress
spec:
  type: {{ .Values.wordpress.service.type }}
  ports:
    - port: {{ .Values.wordpress.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "wordpress.selectorLabels" . | nindent 4 }}
    app.kubernetes.io/component: wordpress', 'wordpress-service.yaml');
INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name) VALUES ('workspace0001', 'templates/ingress.yaml', 1, '2025-01-11 01:03:36.014264', '2025-01-11 01:03:36.014264', '{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "wordpress.fullname" . }}
  labels:
    {{- include "wordpress.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "wordpress.fullname" $ }}-wordpress
                port:
                  number: {{ $.Values.wordpress.service.port }}
          {{- end }}
    {{- end }}
{{- end }}', 'ingress.yaml');

INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('kMw2sFzHS44M', 'v1/Service', 0, 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/templates/service.yaml', '2025-01-11 01:03:30.500928', 'apiVersion: v1
kind: Service
metadata:
  name: {{ include "bootstrap-chart.fullname" . }}
  labels:
    {{- include "bootstrap-chart.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "bootstrap-chart.selectorLabels" . | nindent 4 }}
', 'This is a Kubernetes Service resource definition in a Helm chart with the following characteristics:

Template Variables and Helpers:
- Uses the helper template "bootstrap-chart.fullname" for the service name
- Uses "bootstrap-chart.labels" helper for metadata labels
- Uses "bootstrap-chart.selectorLabels" helper for pod selection

Values from values.yaml:
- `.Values.service.type` - defines the Service type
- `.Values.service.port` - defines the service port

Port Configuration:
- Single port configuration
- Protocol: TCP
- Named: "http"
- Port: (value from .Values.service.port)
- targetPort: http (static)

The chart appears to be named "bootstrap-chart" based on the helper naming patterns. The Service will select pods based on labels defined in the selectorLabels helper template.', '[0.061392,-0.01248,0.029759,0.024222,-0.005918,0.007836,0.002998,0.009601,-0.024328,-0.027859,-0.020451,0.006878,0.056551,0.034497,0.001851,-0.047277,-0.013678,-0.000139,0.021034,0.002438,0.021785,-0.029605,0.006099,0.014047,0.015447,-0.043294,0.027103,0.010516,0.014607,0.017838,-0.029815,0.004198,-0.019433,0.008688,0.023352,0.046893,-0.016142,-0.025022,-0.01926,0.003607,-0.007879,-0.037822,0.040248,-0.017284,0.019629,-0.008319,-0.009797,-0.021819,-0.022323,-0.08314,0.028706,0.053586,-0.01267,0.023225,-0.018208,-0.006026,-0.053293,-0.07833,-0.064222,-0.014597,0.074702,0.011371,0.03725,-0.040418,0.011324,-0.011057,-0.057181,0.001437,-0.051533,0.052704,-0.042252,-0.00983,0.011082,-0.005487,-0.007663,-0.042035,0.013784,-0.020551,0.048654,0.004859,-0.003672,-0.018902,-0.041721,-0.00618,-0.020498,0.010333,-0.005524,-0.007102,0.035758,-0.002973,0.021779,0.041141,0.00616,0.017323,0.024785,0.028289,0.001972,-0.035919,0.013881,0.043773,-0.039607,-0.007165,0.010696,0.047348,-0.053424,0.013284,-0.019436,-0.018373,-0.014072,0.001299,-0.033601,0.042406,0.036961,0.048523,-0.070629,-0.019316,0.069387,0.018987,-0.049113,-0.054321,-0.019956,0.02008,0.012104,-0.05876,0.035536,0.000495,-0.01248,0.031106,-0.060801,0.008073,0.017683,0.005786,0.057958,0.003562,0.036058,-0.042349,-0.078183,0.017931,0.027803,0.002478,-0.017735,0.03312,-0.010071,-0.000528,0.022358,0.012904,-0.00228,-0.067993,-0.015684,0.016689,-0.00742,0.014722,0.010942,0.0275,0.029811,0.026377,-0.052364,-0.000398,0.035597,0.020304,0.031585,0.006211,-0.011645,-0.028834,-0.036354,-0.025299,-0.018033,-0.039713,-0.016792,-0.035833,-0.045422,0.059214,0.007719,0.000809,0.004267,0.043263,-0.032578,-0.00453,0.034573,0.013863,-0.023356,0.051369,0.018357,-0.06489,-0.011226,0.024025,0.025208,-0.003966,0.013674,-0.028293,0.016771,0.03443,-0.01385,0.028099,-0.028702,-0.020623,-0.024062,0.006476,-0.020999,0.012561,0.003467,0.05073,0.035981,0.044748,0.047617,-0.008895,0.005002,0.027916,-0.002392,0.022728,-0.015201,0.004657,-0.005162,-0.077822,-0.013953,-0.01974,-0.01123,-0.037083,-0.06949,0.002202,-0.052589,0.012027,-0.024379,-0.036325,0.052959,-0.012111,-0.020553,0.051971,0.029121,-0.030728,0.013509,0.014598,0.020738,0.030322,0.022541,0.013263,-0.021155,0.03101,0.003063,0.029099,-0.029536,-0.029817,-0.004629,-0.012947,0.048434,-0.038941,0.019155,-0.008405,0.004495,-0.030354,0.017564,-0.042111,-0.019689,-0.04868,-0.017908,0.006478,-0.036763,0.031204,0.012394,-0.011234,-0.044439,0.055038,0.001306,-0.061486,0.0127,0.051397,-0.031285,-0.010599,0.043212,0.003637,-0.001107,0.036573,0.012942,0.006642,0.037955,-0.027826,-0.009465,-0.031883,0.000966,-0.00091,-0.030508,0.012057,-0.014072,0.012792,-0.042239,0.042679,0.048167,0.017868,0.025476,-0.004341,0.016805,0.005155,-0.07551,-0.040679,0.013879,-0.013179,-0.023984,-0.008544,-0.016442,0.0024,-0.009624,-0.036247,-0.029284,0.042881,0.002521,-0.035587,0.036074,-0.008937,0.063324,-0.027894,0.008628,0.004521,-0.000576,-0.028729,-0.078553,-0.095723,0.032843,0.017901,0.030812,0.030855,-0.031621,0.014201,-0.024688,-0.019724,-0.01804,-0.023124,-0.015601,-0.002254,-0.013435,0.056974,0.034186,-0.010456,-0.014159,-0.025374,0.053014,-0.01677,0.018664,-0.084533,-0.01317,0.027284,-0.037118,0.008961,0.031475,-0.010391,0.045298,0.012134,0.009048,-0.018366,0.037244,-0.006099,0.009293,0.009328,0.037018,0.000786,0.083092,-0.003213,-0.005289,-0.039051,0.075683,-0.017131,0.036182,0.057584,-0.053855,-0.00474,-0.085566,0.064539,0.047136,0.03715,-0.033817,0.039536,-0.012822,-0.007082,-0.015744,-0.024626,0.015352,0.025626,0.042714,0.029888,0.018959,0.018133,0.015208,-0.008496,0.012334,0.023798,-0.018502,0.015371,-0.002041,0.011635,-0.022681,-0.026348,0.01406,0.013457,0.009024,-0.016353,-0.005071,0.043098,-0.000315,0.00357,0.043053,-0.035935,-0.013613,0.019086,0.008323,-0.012672,0.012264,0.020773,0.021904,0.045865,-0.027555,-0.059909,-0.011989,-0.000735,-0.004326,0.031437,0.05086,0.02513,0.013317,0.027216,0.024922,-0.014284,0.040754,-0.020387,-0.020961,0.061337,0.03517,0.031041,-0.008538,-0.064108,0.002266,0.05949,0.056958,-0.027409,-0.017716,-0.056473,-0.032594,-0.073843,-0.04524,0.048432,0.017603,-0.028906,-0.022615,0.054685,-0.028159,0.022148,0.010521,0.002184,0.032852,0.038916,-0.023946,0.06376,0.024775,0.022353,0.023788,-0.000487,0.010517,0.019953,-0.003612,-0.062931,0.021742,-0.012147,-0.022545,-0.020643,-0.02853,0.062699,-0.00122,-0.023293,0.02792,-0.006005,-0.013534,-0.033031,-0.014863,-0.036336,0.012755,0.031191,0.02076,-0.031356,-0.007367,0.032007,0.046063,0.008085,-0.02427,0.039892,-0.037671,0.055013,-0.002247,-0.052916,0.040279,0.012243,0.035102,-0.035107,0.099335,0.052477,-0.00814,-0.022844,-0.001415,0.023574,0.020034,0.00463,-0.009819,-0.014051,-0.006521,-0.001521,0.012764,0.013131,0.030454,-0.019161,0.01533,0.003389,-0.047041,0.035741,0.005926,0.002037,-0.012753,0.060247,-0.016261,0.042176,0.01908,0.025662,0.018196,-0.011883,-0.029159,0.020876,-0.032068,-0.033085,-0.017978,0.006317,0.007039,-0.005486,0.015096,-0.004398,-0.035646,-0.042822,0.004534,-0.014062,-0.022368,-0.023,0.032059,-0.022917,-0.017624,0.005321,0.026326,-0.047193,0.000886,0.014363,-0.001631,-0.006906,0.002293,0.017159,-0.018164,0.006251,-0.025964,0.025182,0.025996,-0.00494,0.0394,-0.004666,0.009585,0.074118,0.039656,0.013901,-0.021109,-0.02971,0.026244,-0.064852,-0.009788,0.009068,0.022519,0.014489,-0.011484,-0.0069,0.025438,0.008922,0.0522,-0.004011,-0.02573,0.037884,0.03708,-0.026811,0.027116,-0.068317,-0.006964,-0.008854,-0.041183,-0.023829,0.017014,0.023424,-0.035039,-0.018998,-0.003615,-0.011494,0.011893,0.031731,-0.001551,-0.045471,-0.005421,-0.040752,0.028154,-0.066637,-0.019885,0.026146,-0.008533,-0.00553,-0.023083,0.021086,-0.006235,-0.066641,0.008008,0.001358,0.021904,0.003962,-0.066131,0.034607,-0.046682,-0.022614,-0.027431,-0.003459,-0.038677,0.07598,-0.034948,-0.013011,0.001413,0.007084,-0.032445,-0.019791,-0.007942,0.030626,-0.008706,-0.024952,-0.059514,0.006738,-0.044603,-0.042647,-0.009402,-0.020157,0.046509,0.006566,-0.064414,-0.00482,-0.044067,0.023434,0.005822,0.018153,-0.006791,0.004065,0.052859,0.015642,0.007481,0.038812,-0.010554,0.017545,0.010697,-0.027033,0.050269,0.015435,-0.058886,0.053246,0.000913,-0.004008,0.033862,-0.06947,0.022147,-0.065754,-0.041151,-0.031243,-0.005937,-0.026782,-0.019161,0.08492,0.03878,-0.025585,0.025358,-0.008245,0.017746,0.052601,-0.016966,0.011027,0.030133,-0.041664,0.013069,0.021374,-0.007352,-0.006817,-0.000306,0.051934,0.02117,-0.008861,0.020051,0.006117,0.002153,-0.031426,-0.025515,-0.036266,0.001425,-0.013032,0.085015,0.008405,-0.0151,-0.016831,0.028617,0.041712,0.033094,0.024534,-0.053816,0.053558,0.006685,-0.000245,0.10418,-0.031804,0.009318,-0.049513,-0.018532,-0.013227,0.032306,0.016669,0.019317,-0.023468,0.007732,0.023925,-0.001925,0.032297,0.045344,0.008045,-0.02507,0.02782,0.008153,-0.010201,0.005286,-0.022405,-0.012769,-0.027976,-0.003532,0.022668,0.011941,-0.024144,-0.06658,0.000796,0.02858,-0.013343,-0.000926,-0.011236,0.043481,0.018569,0.009801,-0.029382,-0.071174,-0.016601,-0.035714,-0.019865,-0.017224,0.01006,0.002443,-0.018122,0.03086,-0.007233,0.024411,-0.002938,-0.002087,0.037454,0.011684,-0.013623,0.040661,0.018308,0.02333,-0.031653,-0.034081,0.027101,-0.050485,-0.021553,-0.007661,-0.065654,-0.006177,-0.039388,-0.047369,0.027848,-0.030259,-0.028943,-0.011373,-0.064102,0.016389,-0.004962,0.004074,-0.023988,0.014934,-0.040651,-0.027155,-0.034648,-0.02958,-0.03087,-0.029477,0.045905,0.017898,0.05527,0.003877,0.007398,-0.045879,0.025604,-0.004223,-0.006866,0.030227,0.025412,0.006605,0.036332,-0.009646,-0.063387,0.03735,-0.004831,0.036665,-0.009508,0.036497,0.018877,-0.022872,-0.003904,0.014789,0.026067,0.010932,-0.004122,-0.000821,-0.031347,0.017914,-0.016107,-0.043441,-0.057554,-0.016552,-0.038734,-0.007506,-0.017491,-0.057825,-0.005008,-0.043833,0.020486,-0.017182,-0.006644,-0.026675,-0.027548,0.007252,0.018824,0.00742,-0.015225,0.034327,-0.049232,0.003306,0.014756,0.055874,-0.004359,-0.001717,-0.030643,0.053375,-0.034238,0.028592,0.022771,-0.026557,0.014331,-0.007489,-0.049098,-0.033873,0.053093,-0.037762,-0.017844,-0.017604,0.02699,-0.009631,-0.040943,0.005539,0.036168,0.007172,0.038115,0.023631,0.022282,0.004713,-0.022117,-0.063305,0.024599,0.063799,0.008235,0.007665,-0.063726,0.07881,-0.001631,0.024948,-0.056169,0.009102,0.020885,-0.045314,-0.024692,0.011443,0.006423,0.037433,-0.011659,-0.047058,-0.018447,0.031477,0.042923,-0.016121,0.000443,-0.004724,0.004804,-0.04051,-0.033896,0.063711,0.04242,-0.025987,0.020288,0.00097,0.001513,-0.019112,-0.008707,-0.038818,0.018772,0.004608,-0.013544,0.02628,0.020494,-0.011976,0.008393,-0.038666,0.036549,0.022915,-0.035196,0.005038,0.041345,0.061769,0.055298,0.027382,-0.017319,0.05188,0.022352,0.032381,0.001425,-0.013321,-0.040364,0.020102,0.015018,0.019291,0.063711,-0.002089,-0.019052,0.000414,0.022437,0.045234,0.016755,-0.011698,0.041336,0.02171,0.00893,-0.002617,0.011281,0.048331,-0.04367,0.002278,-0.005708,0.05077,-0.00975,0.04382,0.01543,0.074884,-0.016979,-0.007853,-0.020496,-0.018753,-0.005621,-0.006656,0.019005,0.046496,0.022241,-0.007064,0.027329,0.007816,-0.018441,0.03914,-0.0323,0.024169,0.038137,-0.033753,-0.035916,-0.01773,-0.017342,-0.001452,0.002112,-0.085974,-0.036717,0.035825,-0.022923,-0.026661,0.017523,0.013144,-0.033434,0.005642,0.011057,-0.026654,0.009909,0.021231,0.022149,-0.019437,0.025252,0.019901,0.051475,0.00857,0.012216,-0.03558,0.000579,0.091096,-0.035993,0.019118,0.074557,0.014575,0.039062,0.053518,0.01371,0.015576,-0.027914,-0.043765,-0.045997,0.009107,-0.007714,0.01317,0.016422,0.006134,-0.011989,0.0022,0.017195,0.029568,0.010949,0.024428,-0.024219]', 'Q2mCODgeuRBo');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('kMw2sFzHS44M', '', 0, 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/templates/_helpers.tpl', '2025-01-11 01:03:30.500928', '{{/*
Expand the name of the chart.
*/}}
{{- define "bootstrap-chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "bootstrap-chart.fullname" -}}
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
{{- define "bootstrap-chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "bootstrap-chart.labels" -}}
helm.sh/chart: {{ include "bootstrap-chart.chart" . }}
{{ include "bootstrap-chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "bootstrap-chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "bootstrap-chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "bootstrap-chart.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "bootstrap-chart.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
', 'This is a standard Helm chart helper template (`_helpers.tpl`) for a chart named "bootstrap-chart". Let me break down the named templates and their variables:

1. `bootstrap-chart.name`:
- Uses `.Values.nameOverride` or falls back to `.Chart.Name`
- Truncates to 63 chars

2. `bootstrap-chart.fullname`:
- Uses `.Values.fullnameOverride` if set
- Otherwise combines `.Release.Name` with chart name
- Takes into account `.Values.nameOverride`
- Truncates to 63 chars

3. `bootstrap-chart.chart`:
- Combines `.Chart.Name` and `.Chart.Version`
- Replaces "+" with "_"
- Truncates to 63 chars

4. `bootstrap-chart.labels`:
- Includes standard Kubernetes labels
- Uses `.Chart.AppVersion`
- Uses `.Release.Service`
- Incorporates selector labels

5. `bootstrap-chart.selectorLabels`:
- Sets `app.kubernetes.io/name` using the chart name
- Sets `app.kubernetes.io/instance` using `.Release.Name`

6. `bootstrap-chart.serviceAccountName`:
- Uses `.Values.serviceAccount.create` boolean
- Uses `.Values.serviceAccount.name` if provided
- Falls back to full name or "default"

Required values in `values.yaml` would be:
- `nameOverride` (optional)
- `fullnameOverride` (optional)
- `serviceAccount.create` (boolean)
- `serviceAccount.name` (optional)

This is a typical helper template setup used for consistent naming and labeling across all resources in the chart.', '[0.041568,-0.014426,0.001461,0.026879,0.01137,0.008504,0.001201,0.010073,-0.018894,-0.01568,-0.021615,-0.016719,0.043962,0.024015,-0.015341,-0.024391,-0.030803,0.001807,-0.002835,0.019576,0.009184,-0.05114,-0.001492,0.021265,0.01277,-0.020704,0.038837,0.013071,0.01157,-0.004229,-0.032765,-0.034009,-0.02395,0.027266,0.026136,0.050385,-0.037653,-0.025651,-0.023377,0.010777,-0.032862,-0.045227,0.033511,-0.030145,0.010236,0.026154,-0.026589,-0.003016,-0.014744,-0.0356,0.029855,0.052497,0.001056,0.020988,-0.031578,0.013965,-0.050847,-0.044502,-0.001139,-0.020427,0.038456,0.034486,0.011022,-0.012512,-4.5e-05,-0.007057,-0.053481,0.016482,-0.028822,0.034041,-0.02911,-0.009422,0.032532,0.01022,-0.018181,-0.015571,0.002756,-0.024055,0.016104,0.006855,-0.023253,-0.032402,-0.027322,0.002042,-0.006072,0.022413,-0.020937,-0.028235,0.044026,-0.022729,-0.004786,0.047484,-0.002997,0.014566,0.022097,0.016376,-0.013777,-0.042224,0.00215,-0.002033,-0.039919,0.002268,0.016129,0.038922,-0.031398,0.034791,-0.017534,-0.008035,-0.028354,-0.005413,-0.032386,0.052593,0.066024,0.021621,-0.065339,-0.022408,0.065461,0.018599,-0.034647,-0.050351,-0.039177,0.023546,0.028135,-0.063499,0.032396,-0.005973,-0.001953,0.01202,-0.039433,0.002533,0.006228,0.035806,0.037092,0.010931,0.01525,-0.024736,-0.079467,0.014027,0.026421,-0.002351,-0.016298,0.047806,-0.008146,0.004448,0.029418,-0.014889,-0.002896,-0.045185,-0.007104,-0.004941,-0.005268,0.026008,0.014998,0.00487,0.008342,0.016814,-0.026496,-0.011844,0.01818,0.000198,0.008884,0.011815,-0.019588,-0.025228,-0.01183,-0.030155,-0.044774,-0.028368,-0.025685,-0.042641,-0.046436,0.054546,0.024633,0.027216,0.006392,0.048716,-0.028582,0.012693,0.035169,0.001068,-0.04927,0.027809,-0.016018,-0.062415,0.004085,0.026429,0.032647,-0.015934,0.024833,-0.024853,0.028923,0.04209,0.0166,0.021875,-0.01457,0.004999,-0.015013,0.033102,-0.001398,0.018185,0.01164,0.044043,0.017924,0.034024,0.043153,-0.009424,0.018939,-0.000185,-0.006196,0.025353,-0.037008,-0.013314,-0.021157,-0.081076,0.02776,0.017674,0.003375,-0.034488,-0.100933,-0.007506,-0.038063,0.053199,-0.002954,-0.062832,0.080184,-0.023386,-0.007647,0.041538,0.02158,0.000751,-0.020805,0.017323,0.016377,0.04898,0.046862,0.014683,-0.017239,0.046044,-0.002111,0.003344,-0.030707,-0.040643,-0.022094,-0.025085,0.065066,-0.037303,0.017267,-0.015284,0.001439,-0.050055,0.000558,-0.041012,-0.009932,-0.047749,-0.025818,-0.00705,-0.017051,0.01722,-0.003861,-0.003135,-0.037068,0.030003,-0.038236,-0.063218,0.023563,0.062246,-0.05238,0.026644,0.023017,-0.000856,0.022255,0.0518,0.020831,0.006407,0.028241,-0.027915,-0.008215,-0.031944,-0.009048,-0.013243,-0.034032,0.034977,0.010482,0.009374,-0.046542,0.044795,0.053836,0.030899,0.015268,-0.002948,0.020425,0.014285,-0.066167,-0.03392,0.010918,0.017678,-0.070445,-0.006417,-0.017392,-0.001443,-0.030969,-0.047438,0.007256,0.072386,0.016862,-0.026498,0.009808,0.014513,0.091716,-0.013211,0.007551,0.00487,-0.017603,-0.046658,-0.052514,-0.082853,0.016076,0.016953,0.011776,0.037966,-0.015258,0.005419,-0.034164,-0.008359,2e-06,-0.043621,-0.036019,-0.017365,-0.005207,0.051728,0.004337,0.010279,0.008122,-1.9e-05,0.021119,0.013483,-0.000505,-0.096414,-0.024527,0.029042,-0.064053,0.010654,0.020906,0.03585,0.037107,0.013584,-0.01434,0.004905,0.028992,-0.000745,0.010528,0.019429,0.005183,0.013352,0.077222,-0.011214,0.01654,-0.035524,0.083881,-0.012591,0.008737,0.054553,-0.062608,-0.009785,-0.073221,0.017076,0.035231,0.040146,-0.019901,0.026273,-0.016565,-0.025352,0.00142,-0.056927,0.013503,0.036829,0.016965,0.042503,0.014589,-0.001589,0.01001,0.00514,0.031881,0.0172,-0.027277,0.014662,-0.007701,0.020812,-0.019513,-0.014685,-0.009597,0.010005,0.026328,-0.013734,-0.001234,0.015171,-0.007497,0.009616,0.058017,-0.031014,-0.002021,5e-05,0.022428,-0.01517,0.010696,0.022594,0.063833,0.061058,-0.020637,-0.032452,-0.010411,0.017766,-0.014083,0.02163,0.030877,0.047314,-0.004399,0.021018,0.017946,0.00945,0.035872,-0.023702,-0.025257,0.028199,0.004411,0.018428,-0.012491,-0.045733,-0.019269,0.031329,0.01475,-0.008567,-0.038879,-0.04144,-0.03124,-0.082696,-0.012848,0.02197,-0.05033,0.01225,0.000242,0.044366,0.009752,0.047013,0.00445,-0.035539,0.010561,0.034387,-0.015129,0.08612,0.025718,-0.012406,0.056029,-0.024616,0.02194,0.024594,0.02308,-0.024467,0.012549,-0.001817,0.003007,-0.019976,-0.031672,0.031595,0.01767,-0.018661,0.018194,0.008055,-0.042686,0.006871,-0.010109,-0.047193,0.011972,0.017075,0.026832,-0.038474,0.012631,0.01401,0.01798,-0.000425,-0.022304,0.029769,-0.018653,0.058489,-0.001061,-0.021365,0.03123,0.014609,0.055854,-0.056852,0.082564,0.059335,0.008844,-0.027751,0.009374,0.024407,0.035419,0.012998,-0.007167,0.011459,-0.017768,-2.4e-05,0.038445,0.027334,0.042397,-0.052868,0.025889,-0.020345,-0.024514,0.060919,0.001099,0.012317,-0.033384,0.038271,-0.015846,0.018758,0.011224,-0.011708,-0.000714,0.010051,-0.068822,0.018194,-0.035239,-0.013201,-0.024037,0.012654,0.038927,0.021342,-0.002362,0.00839,0.00166,-0.031264,0.012447,-0.004699,-0.027381,-0.013329,0.001122,-0.02858,-0.020932,0.014116,0.025708,-0.023952,-0.001653,0.003594,0.02152,-0.010529,0.00481,0.0297,0.002845,0.010495,-0.052652,0.011606,0.037445,0.005163,0.037692,-0.02532,0.007836,0.049657,0.038488,0.031733,0.001931,-0.052621,0.014613,-0.068028,-0.019462,-0.000472,0.009763,0.00732,0.015313,-0.010801,0.01802,0.009198,0.067797,-0.01831,-0.021688,0.016075,0.01644,-0.021355,0.001097,-0.056231,-0.001139,0.014401,-0.056462,-0.026569,-0.010612,-0.007307,-0.066489,-0.026998,-0.007658,-0.007858,-0.014328,0.053965,-0.019857,-0.021684,-0.003367,-0.023528,0.008934,-0.079514,-0.007327,0.013822,0.012057,0.005202,-0.0195,0.006212,-0.010921,-0.07176,0.012737,-0.023297,0.01558,-0.020494,-0.082931,0.040554,-0.031094,-0.01583,-0.027283,-0.00667,-0.042956,0.068721,-0.024793,-0.006685,9.8e-05,0.005577,-0.015492,-0.027216,-0.006181,0.015897,-0.020929,-0.023204,-0.052469,0.006366,-0.024376,-0.063033,-0.004804,-0.017707,0.018017,0.015476,-0.037354,-0.015523,-0.013833,0.006515,0.026122,0.026884,0.027383,-0.015358,0.068859,0.014519,0.026285,0.071544,0.020028,0.008538,0.011685,-0.033994,0.006112,0.025748,-0.057712,0.078647,0.021713,-0.000365,0.03304,-0.05625,0.022937,-0.06695,-0.0253,-0.023279,-0.020852,-0.005315,0.007137,0.074302,0.032861,-0.044665,0.027631,-0.010588,0.015852,0.045921,-0.001638,0.017719,0.009905,-0.054341,0.008693,0.014961,-0.043142,0.008075,0.000206,0.041513,0.026892,0.01067,0.016218,-0.00404,-0.010383,-0.047433,-0.004592,-0.031275,-0.019795,-0.005996,0.063989,0.011278,-0.012157,-0.049966,0.036312,0.068463,0.041368,0.01216,-0.046919,0.05559,-0.018771,-0.023182,0.091131,-0.035231,0.016684,-0.074699,-0.018616,-0.004382,-0.000141,0.035651,-0.00204,-0.001991,0.00191,0.025151,-0.027615,0.032418,0.006542,0.014137,-0.016159,0.034277,0.019894,-0.008897,-0.018464,-0.009271,-0.005959,-0.019347,0.018035,0.023619,0.0041,-0.012304,-0.04466,-0.011636,0.029511,-0.018047,0.018553,-0.000764,0.044198,-0.022868,-0.017243,-0.034118,-0.052816,0.008742,-0.053867,-0.030515,-0.02086,-0.000541,-0.003804,-0.024752,0.009996,-0.005824,-0.011313,-0.026561,-0.012388,0.040391,-0.009745,-0.005986,0.045979,0.043067,0.034814,-0.010092,-0.032997,0.018059,-0.021514,-0.019097,-0.011468,-0.058232,-0.034324,-0.031018,-0.019598,0.008454,-0.045042,-0.021476,-0.017781,-0.068673,0.005151,0.003857,-0.004606,0.000806,-0.000523,-0.072109,0.014465,-0.024047,-0.061275,-0.013415,-0.005071,0.037273,-0.025289,0.052721,-0.022249,-0.004849,-0.063163,0.022827,0.022667,0.000411,0.017463,0.015401,0.029496,0.020654,-0.010761,-0.05868,0.061394,0.012175,0.06584,-0.031039,0.053703,0.012553,-0.029672,0.01023,-0.01063,0.038438,0.013818,0.020149,-0.0507,-0.036146,0.021954,-0.035742,-0.03682,-0.049418,-0.011433,-0.041685,0.005845,-0.035491,-0.013364,0.014353,-0.045822,0.025897,0.005578,0.005817,-0.018794,-0.012831,0.010986,0.00292,-0.001326,-0.040766,0.018052,-0.01688,0.005055,0.031791,0.05938,0.015568,-0.004661,-0.040525,0.057359,-0.046005,0.03788,0.008859,-0.015027,0.015031,-0.008935,0.002628,-0.040501,0.046894,-0.038672,-0.024108,-0.012358,0.056531,-0.020399,-0.052735,-0.022791,0.034358,0.032798,0.005951,0.049952,0.047081,0.011826,0.002347,-0.100244,0.043501,0.02995,-0.021507,-0.019503,-0.060323,0.078906,-0.011126,0.011295,-0.059953,0.04822,0.022601,-0.041749,-0.022525,0.020863,-0.002367,0.038599,-0.020886,-0.021026,-0.012931,0.019288,0.035835,-0.048309,-0.02944,-0.016797,0.008276,-0.029021,-0.044785,0.062331,0.028868,0.003294,0.024499,-0.034162,0.026459,-0.007493,-0.031187,-0.04586,0.019975,0.032511,-0.018002,-0.004432,0.023286,-0.009718,0.01633,-0.032129,0.040882,0.004613,-0.016046,0.017545,0.019379,0.058711,0.059522,0.01222,0.014359,0.028976,0.019914,0.009678,-0.02129,-0.024147,-0.060666,0.023706,0.035471,0.027463,0.042836,-0.003592,-0.00992,-0.006609,0.016922,0.039696,-0.007906,-0.019106,0.026405,0.035666,0.008269,-0.025995,-0.025605,0.050944,-0.057357,-0.001858,-0.001142,0.088112,0.020742,0.003071,0.029303,0.034283,-0.023441,-0.044158,-0.019266,-0.032197,-0.023615,-0.026658,0.02259,0.051027,0.027985,0.001797,0.008048,0.009862,-0.034697,0.049584,-0.014993,0.028677,0.045381,-0.016617,-0.022996,-0.019559,-0.020733,0.005245,-0.008814,-0.084276,-0.025845,0.025163,-0.039484,-0.035009,0.022863,-0.006608,-0.015788,0.002393,0.014329,-0.034861,0.003823,-0.015362,0.014948,-0.010044,0.04555,0.03346,0.03216,0.00143,0.029085,-0.02082,0.015173,0.07641,-0.043689,0.011403,0.066162,0.03935,0.038331,0.037761,-0.005627,0.013511,-0.019937,-0.043269,-0.013995,-0.001762,0.015133,0.022726,0.008722,-0.009276,-0.01235,0.005276,0.024489,0.000311,0.003441,0.030953,-0.029669]', '59u10Mo9bIXv');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('kMw2sFzHS44M', 'v1/ServiceAccount', 0, 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/templates/serviceaccount.yaml', '2025-01-11 01:03:30.500928', '{{- if .Values.serviceAccount.create -}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "bootstrap-chart.serviceAccountName" . }}
  labels:
    {{- include "bootstrap-chart.labels" . | nindent 4 }}
  {{- with .Values.serviceAccount.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
automountServiceAccountToken: {{ .Values.serviceAccount.automount }}
{{- end }}
', 'Here''s a summary of the ServiceAccount resource in your Helm chart:

1. **Conditional Creation**:
   - Only created if `.Values.serviceAccount.create` is true

2. **Resource Details**:
   - API Version: v1
   - Kind: ServiceAccount

3. **Metadata**:
   - Name: Uses template helper `bootstrap-chart.serviceAccountName`
   - Labels: Uses template helper `bootstrap-chart.labels`
   - Annotations: Dynamically added from `.Values.serviceAccount.annotations` if present

4. **Configuration**:
   - `automountServiceAccountToken`: Controlled by `.Values.serviceAccount.automount`

5. **Values Used**:
   - `.Values.serviceAccount.create`
   - `.Values.serviceAccount.annotations`
   - `.Values.serviceAccount.automount`

6. **Template Helpers Used**:
   - `bootstrap-chart.serviceAccountName`
   - `bootstrap-chart.labels`

This ServiceAccount template allows for conditional creation, customizable annotations, and configurable token automounting, following Helm best practices for templating and configuration.', '[0.047383,-0.027149,-0.001157,0.038798,-0.011622,0.006284,0.001727,0.003392,-0.034558,-0.026104,-0.020118,-0.002863,0.064354,0.011934,-0.003718,-0.010607,-0.023266,0.001464,0.001383,0.022982,0.024413,-0.04952,0.006364,0.017632,0.022188,-0.063536,0.015224,0.01841,-0.00153,0.016836,-0.007154,-0.027929,-0.006228,0.002132,0.03627,0.048022,-0.014604,-0.035457,-0.015444,0.012902,-0.05612,-0.056569,0.023156,-0.003234,0.024326,0.002811,0.005654,-0.016445,-0.035226,-0.054616,0.031339,0.058262,-0.003783,0.006645,-0.009363,0.011847,-0.074011,-0.046549,-0.036591,-0.020143,0.024846,0.033609,0.017285,-0.013766,-0.002937,0.019168,-0.054018,0.009593,-0.041536,0.033171,-0.056096,-0.002145,0.005426,0.006727,-0.02243,-0.036224,0.038769,-0.018476,0.048627,0.008029,-0.014913,-0.033132,-0.026194,-0.01069,-0.005001,-0.00175,-0.011127,-0.006165,0.039914,-0.012087,-0.007574,0.050573,-0.015207,0.000963,0.011697,0.038226,-0.006027,-0.054451,0.016133,0.029235,-0.042518,0.003319,0.035793,0.034825,-0.027626,0.038422,-0.011189,0.027484,-0.032913,0.002869,-0.017162,0.064914,0.070266,0.038459,-0.052843,-0.022935,0.040047,0.028252,-0.041092,-0.020312,-0.014067,0.034131,0.012743,-0.051118,0.024574,-0.023242,-0.007571,0.005831,-0.042718,-0.001594,-0.015197,0.00248,0.018475,0.022636,0.024806,-0.018026,-0.074202,0.020451,0.035718,-0.010384,-0.036203,0.037261,-0.025637,0.011631,0.004328,-0.001826,0.018637,-0.054396,-0.026048,0.020074,-0.017677,0.023183,-0.000305,0.011368,0.002871,0.006152,-0.021601,0.000371,0.017374,-0.004072,0.016345,-0.013412,-0.008338,-0.036535,-0.035822,-0.052675,-0.023434,-0.055171,0.011852,-0.02391,-0.041053,0.035509,0.006349,0.020389,0.01474,0.012671,-0.04355,0.025979,0.02283,0.005339,-0.03721,0.027658,0.007665,-0.050507,-0.006003,0.045947,0.024344,-0.007524,0.026574,-0.040863,0.035403,0.033616,-0.018736,0.019651,-0.020705,0.003787,-0.011227,0.003504,-0.002628,0.009958,0.000494,0.037413,0.016934,0.051632,0.03904,-0.004796,0.01505,0.025465,0.014457,0.023507,-0.001199,0.006135,-0.025625,-0.064098,-0.004767,-0.030972,0.001086,-0.03628,-0.052465,0.01437,-0.056621,0.004465,0.006409,-0.02835,0.062365,-0.033517,-0.02431,0.034188,0.025765,-0.005097,-0.013057,0.021563,0.030501,0.052602,0.045403,0.039237,-0.029347,0.033816,0.010728,0.027322,-0.032717,-0.018857,0.006849,-0.030828,0.050379,-0.039473,0.032551,-0.017427,0.002529,-0.054579,-0.007321,-0.043756,-0.027125,-0.027813,-0.020222,-0.016936,-0.013687,0.05179,-0.003147,-0.013141,-0.053508,0.046087,-0.013604,-0.074577,0.041195,0.052363,-0.031348,0.001013,0.037441,-0.015955,-0.001193,0.067356,-0.006081,0.019675,0.012481,-0.033993,-0.012208,-0.019431,-0.016823,-0.034948,-0.042475,0.020696,0.017306,-0.021361,-0.03089,0.042257,0.050065,-0.008322,0.007541,0.013998,0.037438,0.018162,-0.030308,-0.025904,0.025332,-0.021025,-0.043626,0.006527,-0.030118,-0.015147,0.002053,-0.038286,0.003277,0.067174,-0.0058,-0.044398,0.013089,-0.001491,0.056732,-0.016151,0.009858,-0.007286,-0.037874,-0.016045,-0.045295,-0.09272,0.028344,0.018513,0.035924,0.038188,-0.020982,0.031127,-0.011995,-0.011226,-0.004865,-0.055485,-0.017982,-0.021854,-0.010581,0.042803,-0.008545,-0.010687,0.032094,-0.006322,0.05407,0.015045,-0.005714,-0.066521,-0.032419,-0.004366,-0.057004,-0.00449,0.033967,0.015837,0.046934,0.021489,-0.006775,-0.019421,0.047816,0.002005,0.020656,0.02776,0.038358,0.021333,0.070616,-0.025908,0.007591,-0.014989,0.091523,-0.023386,0.02774,0.061935,-0.066947,-0.01149,-0.07117,0.02315,0.035138,0.025194,-0.024161,0.029218,-0.007794,-0.017261,-0.018147,-0.029197,0.032875,0.048027,0.028096,0.020448,0.046712,0.008197,0.004832,0.02289,0.022294,0.046632,-0.016485,0.014182,-0.023333,0.009882,-0.04218,-0.018718,0.00194,-0.004946,-0.012727,-0.022012,-0.017208,0.026251,-0.014136,0.003353,0.05359,-0.018678,-0.033122,0.005478,0.020516,-0.035413,0.028486,0.013397,0.02125,0.061452,-0.020285,-0.030149,0.003484,0.012708,0.000395,0.038818,0.025883,0.046607,-0.016849,0.032928,0.032886,-0.010311,0.041617,-0.02336,-0.010914,0.057209,0.018426,0.038642,-0.018626,-0.054107,0.009008,0.034767,0.067401,-0.013115,0.001517,-0.046879,-0.034103,-0.087214,-0.016844,0.032266,-0.001938,-0.017896,-0.012142,0.041663,-0.041779,0.025168,0.015193,-0.016538,0.00897,-0.013389,0.014465,0.073408,0.041894,0.004381,0.015968,-0.015525,0.001935,-0.013753,-0.003242,-0.0562,-0.009733,0.001161,-0.004336,-0.030275,-0.052489,0.016623,0.018142,-0.038697,0.029953,0.007663,-0.045183,-0.002792,-0.000983,-0.040456,0.034079,0.00391,0.040636,-0.02045,0.013707,0.020926,0.027478,0.021162,-0.021693,0.057888,-0.022751,0.040037,-0.014424,-0.066573,0.037313,0.030427,0.052062,-0.049815,0.080064,0.062265,-0.001439,-0.022946,-0.00528,0.034431,0.009001,-0.005678,0.000515,-0.005924,-0.00449,-0.005832,0.03674,0.002158,0.04944,-0.044037,0.039748,-0.001645,-0.029272,0.03695,0.017814,-0.016095,-0.024666,0.072176,-0.017692,0.039854,0.022819,0.014637,-0.005533,0.017932,-0.058823,0.009586,-0.017304,-0.009883,-0.021359,-0.019759,0.001772,0.008417,0.0071,-0.009595,-0.004386,-0.014761,-0.017941,-0.006761,-0.018125,0.010151,-1.2e-05,-0.022931,-0.012784,0.005334,0.016368,-0.020765,0.008663,0.008444,0.015641,-0.023968,0.001099,0.01584,-0.019818,-0.00211,-0.025238,0.023443,0.037668,-0.001783,-0.000916,-0.033125,-0.004459,0.036952,0.052191,0.024758,-0.003452,-0.021744,0.014649,-0.066603,0.012518,0.004647,0.004026,0.032704,0.018721,-0.013789,0.038282,0.019,0.082514,0.002254,-0.017875,0.028004,0.019637,-0.034642,0.025593,-0.064025,-0.009688,-0.007543,-0.05759,-0.003041,-3e-05,0.001367,-0.040382,-0.007213,-0.017535,-0.00253,0.009873,0.020562,-0.009191,-0.053567,0.008734,-0.027005,0.054649,-0.085398,-0.027512,0.019734,0.016153,-0.011213,-0.034771,0.048583,-0.008335,-0.062285,0.0068,0.008955,0.017059,0.006653,-0.077372,0.03256,-0.029785,-0.020938,-0.052266,-0.02083,-0.020528,0.075709,-0.015246,-0.000192,0.008495,0.01012,-0.061227,-0.025984,0.00652,0.013014,0.00476,-0.031856,-0.036518,-0.007196,-0.037629,-0.043602,-0.001687,-0.026322,0.045402,0.00502,-0.046626,-0.012975,-0.005633,0.000919,0.007575,0.014882,0.029285,-0.018535,0.053731,0.028548,0.010413,0.036065,0.013265,0.027546,0.05687,-0.018139,0.039838,0.011561,-0.069901,0.071013,-0.00289,0.012301,0.009561,-0.047816,0.00175,-0.074844,-0.036019,-0.020057,-0.037068,0.008352,-0.020859,0.072236,0.041649,-0.030012,0.031327,-0.018935,0.024925,0.046828,-0.000647,0.011137,0.024777,-0.052057,0.013423,0.022607,-0.016355,-0.00337,-0.004644,0.056952,0.031797,-0.0002,0.032505,-0.016533,0.021225,-0.0407,-0.026741,-0.041909,-0.004588,0.006224,0.106522,0.011895,-0.027261,-0.034383,0.029129,0.067807,0.015743,0.007803,-0.055426,0.054348,-0.023464,-0.017695,0.11432,-0.045633,-0.007809,-0.064815,-0.021332,-0.001835,0.012471,0.050244,0.01726,-0.00142,-0.007185,0.041997,0.003691,0.019572,0.03324,0.023298,-0.013298,0.042033,0.015214,-0.021229,-0.006588,-0.024944,-0.015201,-0.011958,0.001993,0.006298,0.00469,-0.014011,-0.060927,-0.0166,0.015219,-0.011614,0.013237,0.005161,0.026665,-0.016417,-0.008232,-0.026833,-0.043268,-0.010432,-0.043762,-0.036681,-0.011722,0.021644,-0.020823,-0.02496,0.012331,-0.015356,0.016665,-0.022713,-0.013092,0.031214,0.005921,-0.00761,0.038797,0.030396,0.026995,-0.022212,-0.036685,0.018372,-0.044188,-0.023043,0.024053,-0.042879,-0.010566,-0.039545,-0.018092,0.024852,-0.035612,-0.013297,0.008955,-0.054668,-0.004184,-0.027967,-0.005668,-0.002256,-0.002534,-0.05218,-0.00884,-0.044654,-0.035262,-0.028637,0.000219,0.038905,-0.002231,0.050238,-0.001869,0.010151,-0.034665,0.009605,-0.020169,-0.003119,0.015797,0.011403,0.033132,0.034949,-0.004324,-0.058901,0.037998,0.015325,0.045404,-0.002854,0.059877,0.003905,-0.03228,0.004043,-0.005756,0.042298,-0.014702,0.000674,0.012429,-0.033779,0.033421,-0.01908,-0.050837,-0.029011,-0.003949,-0.040072,0.00614,-0.029355,-0.02589,-0.015935,-0.041156,0.049544,-0.003866,0.017102,-0.018994,-0.024292,0.012005,0.009413,0.027819,-0.022108,0.011323,-0.025993,-0.019625,0.017484,0.063179,-0.011057,-0.002458,-0.029224,0.04699,-0.050672,0.027889,0.024349,-0.038911,0.027567,-0.032625,-0.037905,-0.016473,0.037731,-0.028475,-0.025638,-0.003521,0.047625,-0.007618,-0.046209,0.001063,0.019176,0.007073,0.016694,0.034347,0.041475,0.030927,-0.012179,-0.063053,0.017088,0.036618,-0.002288,-0.003922,-0.069158,0.077058,-0.005236,0.007952,-0.056919,0.022273,0.035431,-0.051949,-0.050221,-0.00929,-0.012883,0.061351,-0.027307,-0.046339,-0.007564,0.019301,0.02665,-0.036088,-0.022602,-0.029823,0.010525,-0.031753,-0.038464,0.045011,0.022331,-0.005123,0.035764,-0.030568,0.023861,-0.015692,-0.053037,-0.036675,0.038656,0.022254,-0.018724,0.009677,0.002965,0.010814,0.010212,-0.020099,0.037521,0.021752,-0.004685,-0.001628,0.048978,0.046742,0.042166,0.017037,-0.019977,0.041038,0.008119,0.021844,-4.8e-05,-0.036204,-0.052193,0.022716,0.02409,-0.004565,0.05765,-0.019184,-0.014068,0.002149,0.042826,0.054723,0.025832,-0.00549,0.013967,0.03022,0.013381,-0.008563,0.007258,0.043012,-0.031182,-0.013702,0.001827,0.08629,0.007667,0.032891,-0.007846,0.070011,-0.024878,-0.018393,-0.01975,-0.032199,0.026201,-0.018268,0.023853,0.033687,0.011903,-0.008377,0.020669,-0.001239,-0.01307,0.046922,-0.005471,0.038973,0.03241,-0.025399,-0.011478,-0.008226,-0.010104,0.019046,-0.006184,-0.079921,-0.040186,0.026463,-0.033217,-0.051212,0.00442,-0.017353,-0.017344,-0.00122,0.029249,-0.028614,0.004438,0.023499,0.021527,-0.008736,0.049128,0.008293,0.042036,0.023632,-0.003753,-0.038299,0.006756,0.072853,-0.044614,0.02735,0.094506,0.052253,0.038295,0.041919,0.002081,0.000188,-0.018877,-0.041791,-0.03292,-0.007323,0.004767,0.021739,0.023205,0.011333,-0.031194,-0.005632,-0.002199,0.021411,-0.00915,0.0404,-0.022659]', 'VDGTktbupbXQ');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('kMw2sFzHS44M', 'values', 0, 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/values.yaml', '2025-01-11 01:03:30.500928', '# Default values for bootstrap-chart.
# This is a YAML-formatted file.
# Declare variables to be passed into your templates.

# This will set the replicaset count more information can be found here: https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/
replicaCount: 1

# This sets the container image more information can be found here: https://kubernetes.io/docs/concepts/containers/images/
image:
  repository: nginx
  # This sets the pull policy for images.
  pullPolicy: IfNotPresent
  # Overrides the image tag whose default is the chart appVersion.
  tag: ""

# This is for the secretes for pulling an image from a private repository more information can be found here: https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/
imagePullSecrets: []
# This is to override the chart name.
nameOverride: ""
fullnameOverride: ""

#This section builds out the service account more information can be found here: https://kubernetes.io/docs/concepts/security/service-accounts/
serviceAccount:
  # Specifies whether a service account should be created
  create: true
  # Automatically mount a ServiceAccount''s API credentials?
  automount: true
  # Annotations to add to the service account
  annotations: {}
  # The name of the service account to use.
  # If not set and create is true, a name is generated using the fullname template
  name: ""

# This is for setting Kubernetes Annotations to a Pod.
# For more information checkout: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/
podAnnotations: {}
# This is for setting Kubernetes Labels to a Pod.
# For more information checkout: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/
podLabels: {}

podSecurityContext: {}
  # fsGroup: 2000

securityContext: {}
  # capabilities:
  #   drop:
  #   - ALL
  # readOnlyRootFilesystem: true
  # runAsNonRoot: true
  # runAsUser: 1000

# This is for setting up a service more information can be found here: https://kubernetes.io/docs/concepts/services-networking/service/
service:
  # This sets the service type more information can be found here: https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services-service-types
  type: ClusterIP
  # This sets the ports more information can be found here: https://kubernetes.io/docs/concepts/services-networking/service/#field-spec-ports
  port: 80

# This block is for setting up the ingress for more information can be found here: https://kubernetes.io/docs/concepts/services-networking/ingress/
ingress:
  enabled: false
  className: ""
  annotations: {}
    # kubernetes.io/ingress.class: nginx
    # kubernetes.io/tls-acme: "true"
  hosts:
    - host: chart-example.local
      paths:
        - path: /
          pathType: ImplementationSpecific
  tls: []
  #  - secretName: chart-example-tls
  #    hosts:
  #      - chart-example.local

resources: {}
  # We usually recommend not to specify default resources and to leave this as a conscious
  # choice for the user. This also increases chances charts run on environments with little
  # resources, such as Minikube. If you do want to specify resources, uncomment the following
  # lines, adjust them as necessary, and remove the curly braces after ''resources:''.
  # limits:
  #   cpu: 100m
  #   memory: 128Mi
  # requests:
  #   cpu: 100m
  #   memory: 128Mi

# This is to setup the liveness and readiness probes more information can be found here: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
livenessProbe:
  httpGet:
    path: /
    port: http
readinessProbe:
  httpGet:
    path: /
    port: http

#This section is for setting up autoscaling more information can be found here: https://kubernetes.io/docs/concepts/workloads/autoscaling/
autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80
  # targetMemoryUtilizationPercentage: 80

# Additional volumes on the output Deployment definition.
volumes: []
# - name: foo
#   secret:
#     secretName: mysecret
#     optional: false

# Additional volumeMounts on the output Deployment definition.
volumeMounts: []
# - name: foo
#   mountPath: "/etc/foo"
#   readOnly: true

nodeSelector: {}

tolerations: []

affinity: {}
', 'This values.yaml file for a Helm chart contains the following key configurations:

1. Basic Deployment Settings:
- `replicaCount`: Defaults to 1
- `image`: Controls container image settings
  - `repository`: Set to "nginx"
  - `pullPolicy`: Set to "IfNotPresent"
  - `tag`: Empty by default

2. Naming and Identity:
- `imagePullSecrets`: Empty array for private registry credentials
- `nameOverride` and `fullnameOverride`: Empty strings for chart naming

3. Service Account Configuration:
- Creates service account by default (`create: true`)
- Enables automounting of credentials (`automount: true`)
- Configurable annotations and name

4. Pod Configuration:
- Empty defaults for `podAnnotations` and `podLabels`
- Empty defaults for `podSecurityContext` and `securityContext`

5. Service Configuration:
- Type: `ClusterIP`
- Port: 80

6. Ingress Configuration:
- Disabled by default (`enabled: false`)
- Example host: chart-example.local
- Configurable className, annotations, paths, and TLS

7. Resource Management:
- Empty `resources` object for CPU/memory limits
- Health Checks:
  - `livenessProbe` and `readinessProbe` configured for HTTP checks
- Autoscaling:
  - Disabled by default
  - Configurable min (1) and max (100) replicas
  - Target CPU utilization: 80%

8. Storage and Volumes:
- Empty arrays for `volumes` and `volumeMounts`

9. Scheduling:
- Empty defaults for `nodeSelector`, `tolerations`, and `affinity`

This is a standard configuration that can be used as a base for deploying web applications, with most production-related features disabled by default but configurable.', '[0.020783,-0.004567,0.004342,0.031526,-0.009037,0.0057,-0.018645,-0.004197,-0.022372,-0.011055,0.003847,-0.016629,0.058413,0.019823,-0.010489,1.4e-05,-0.031232,-0.001404,0.01748,0.002978,-0.016003,-0.040366,-0.004431,-0.004675,0.005537,-0.036757,0.03627,0.022259,-0.003542,0.002251,-0.025737,-0.017484,-0.007224,0.020542,0.055912,0.047843,-0.00932,-0.029674,-0.025402,0.009312,-0.028078,-0.023499,0.019967,-0.005597,-0.017638,0.008162,-0.008254,-0.005339,-0.016124,-0.03611,0.01259,0.06799,0.01356,0.011791,0.00323,0.010174,-0.067594,-0.060401,-0.000831,-0.030067,0.067805,0.020293,0.015542,0.002208,-0.00894,0.006962,-0.038932,-0.00329,-0.023403,0.040321,-0.033035,0.00776,-0.00148,-0.019546,-0.00616,-0.022832,0.013481,-0.015323,0.020746,-0.010807,-0.042923,-0.029833,-0.029877,0.014074,0.005341,0.011565,-0.013493,-0.024707,0.036637,-0.013041,-0.009376,0.06221,-0.020966,0.006748,0.008797,0.001323,-0.00759,-0.02916,0.000748,0.018939,-0.037032,-0.001642,0.025939,0.040319,-0.024575,0.031629,-0.027735,-0.000515,-0.030297,0.018798,-0.042069,0.064489,0.061277,0.027067,-0.0596,-0.037573,0.074087,0.023631,-0.037543,-0.045049,-0.00067,0.040187,0.020676,-0.063795,0.032593,-0.025502,-0.005115,0.001472,-0.038641,0.009029,0.005845,0.009348,0.026164,0.021834,0.004647,-0.030751,-0.082495,0.017308,0.021283,-0.006905,-0.016737,0.056084,-0.004675,-0.006711,0.04602,-0.012876,0.022501,-0.049199,-0.011653,0.001214,0.007504,0.016007,-0.0014,0.002267,0.011525,0.015122,-0.008055,-0.023555,0.029158,0.021087,0.014015,-0.004353,0.001784,-0.00831,-0.008367,-0.044768,-0.019463,-0.030499,0.003241,-0.034845,-0.04461,0.03741,0.014775,0.04012,-0.013129,0.029858,-0.052276,-0.000245,0.015261,0.013677,-0.021708,0.043174,-0.034975,-0.044854,-0.002072,0.033965,0.024723,-0.030069,0.01997,-0.024485,0.034193,0.025434,0.023116,0.029785,-0.003087,-0.000362,-0.018566,0.018811,-0.0219,0.004795,0.008645,0.019636,0.020302,0.024999,0.039013,0.005421,0.029677,0.004449,-0.012311,0.041402,-0.025844,-0.04324,-0.004733,-0.066579,0.004072,-0.00607,-0.009124,-0.022103,-0.09073,0.009464,-0.045735,0.017438,-0.013142,-0.036573,0.084336,-0.035316,-0.024937,0.0584,0.026599,0.002716,-0.003924,0.027381,0.009632,0.010043,0.039932,0.01637,-0.01495,0.034276,0.009739,0.044453,-0.02941,-0.019825,-0.011847,-0.017676,0.064638,-0.038666,0.026341,-0.01136,0.021419,-0.043445,-0.01225,-0.06327,-0.026245,-0.040774,-0.015566,-0.006556,-0.0094,0.007375,-0.004773,-0.053262,-0.03297,0.031797,-0.024049,-0.04703,0.018711,0.061288,-0.044135,0.020005,0.037439,0.001275,0.013264,0.021254,0.012259,0.011728,0.035533,-0.039437,-0.016583,-0.042616,0.010962,-0.008769,-0.055751,0.036497,0.002494,0.009927,-0.052313,0.034727,0.064933,0.013024,0.008932,0.005233,0.018496,-0.005391,-0.055574,-0.029698,0.007123,0.00759,-0.068273,0.001323,-0.00513,-0.023186,-0.037083,-0.060269,0.00441,0.056881,0.007742,-0.06235,0.011404,0.022748,0.076607,-0.025425,-0.028212,-0.008217,-0.031889,-0.014646,-0.030835,-0.088531,0.00323,0.004474,0.015531,0.025185,-0.034211,0.010352,-0.030089,-0.041561,0.007183,-0.049239,-0.038147,-0.024314,-0.016254,0.041743,0.006956,-0.000844,-0.000778,-0.019483,0.027986,0.001167,0.016649,-0.081867,-0.020088,0.00464,-0.063249,0.031238,0.029191,0.015533,0.032344,0.026445,-0.003886,-0.0137,0.023646,-0.003397,0.032053,0.030903,0.028159,0.017414,0.093312,-0.03101,0.007603,-0.020575,0.080884,-0.002488,-0.014908,0.037506,-0.07433,-0.029038,-0.062313,0.029253,0.033429,0.058341,-0.01808,0.053968,-0.018369,-0.015546,-0.014143,-0.052428,0.015896,0.042579,0.030228,0.033456,0.001104,0.018033,0.022157,-0.00986,0.033554,0.019102,-0.028749,0.005414,-0.001788,0.01364,-0.01014,-0.00859,-0.019097,-0.012083,0.021076,-0.008168,-0.006318,0.031805,0.008403,-0.021298,0.037584,-0.046062,-0.021654,-0.000387,0.021699,-0.003407,0.024699,0.018814,0.053779,0.062544,-0.039959,-0.020813,-0.017901,-0.004279,-0.002654,0.022503,0.033869,0.009169,1.6e-05,0.036638,0.031061,0.014379,0.039362,-0.011398,-0.035638,0.052557,0.014791,0.014751,-0.016433,-0.042231,-0.019227,0.044394,0.039216,0.001073,-0.032801,-0.04237,-0.021828,-0.084009,-0.044114,0.045099,-0.037062,-0.005988,0.000245,0.061872,-0.00986,0.031805,0.003493,-0.02162,0.030583,0.031661,-0.041398,0.093433,0.022067,-0.032891,0.048794,-0.024787,0.006567,0.018969,0.024628,-0.024695,0.009368,0.004458,-0.004564,-0.024913,-0.04022,0.039154,0.014634,-0.012627,0.033195,0.020936,-0.038122,-0.005803,-0.000818,-0.032228,0.023917,0.012854,0.024342,-0.035315,0.008844,0.035106,0.011048,-0.004875,-0.018119,0.026672,-0.026195,0.041991,-0.026662,-0.009583,0.029492,0.026968,0.063459,-0.043013,0.09567,0.048975,0.010556,-0.020967,0.007722,0.04981,0.040502,0.007667,-0.001716,-0.001969,-0.001695,0.002433,0.040356,0.031672,0.055759,-0.05998,0.033355,-0.009512,-0.011799,0.05151,0.008041,0.025778,-0.03749,0.059619,-0.006992,0.01704,0.012045,-0.002287,0.001402,0.021785,-0.053839,0.039149,-0.020914,-0.016534,-0.026233,-0.003405,0.032647,0.023299,0.003984,0.000508,0.005326,-0.022862,-0.011834,-0.002997,-0.013353,-0.003214,0.005452,-0.033719,-0.0216,0.005345,0.036244,-0.01923,0.006333,0.009814,0.013506,0.0022,0.016731,0.038085,0.007211,0.009897,-0.038449,-0.004547,0.02762,-0.00037,0.03111,-0.042855,-0.006136,0.054739,0.025605,0.033924,-0.002865,-0.012594,0.022406,-0.061144,-0.029731,-0.001027,-0.022147,0.001244,0.006159,-0.008047,0.020924,0.022196,0.083707,-0.009735,-0.031386,-0.010341,0.041569,-0.032506,-0.006666,-0.035438,-0.002652,0.010431,-0.055167,-0.026278,0.010278,-0.003103,-0.066397,-0.02005,-0.001863,-0.015411,-0.025607,0.033411,-0.011817,-0.035874,-0.013979,0.00932,0.027219,-0.083989,-0.003445,0.051153,0.02383,-0.004118,-0.02161,0.021699,0.003071,-0.057654,0.015206,-0.020531,0.025627,-0.014472,-0.082086,0.060798,-0.02845,-0.043358,-0.023183,-0.012736,-0.035576,0.053595,-0.028703,0.046287,0.019183,0.019601,-0.03605,-0.036201,-0.025063,0.025343,-0.027455,-0.021116,-0.040681,-6.6e-05,-0.033637,-0.043529,-0.006669,-0.010588,0.032898,0.016346,-0.041154,-0.043566,-0.02078,0.016556,0.017716,0.014989,0.031822,0.028267,0.068399,-0.002611,0.048682,0.056942,0.029097,0.023639,-0.008829,-0.043456,0.016305,0.02208,-0.059505,0.066388,0.010342,-0.005152,0.052726,-0.063559,0.000915,-0.083216,-0.031271,-0.028736,0.002094,-0.017876,0.000561,0.050888,0.035254,-0.044181,0.015893,-0.04725,0.00115,0.048538,-0.014447,0.006591,0.028724,-0.063398,0.016432,0.036467,-0.038964,0.007729,-0.003582,0.029025,0.038556,0.002218,0.020596,-0.011281,0.013298,-0.032472,-0.002377,-0.024573,-0.010604,0.008185,0.097121,-0.003767,-0.025849,-0.029243,0.043181,0.055637,0.014808,0.002308,-0.048929,0.046571,-0.018732,-0.043485,0.074226,-0.016187,0.006897,-0.070026,-0.032614,-0.013822,0.002842,0.019253,0.01434,-0.028606,0.002585,0.01459,-0.026136,0.031968,0.006887,0.018073,-0.026111,0.03793,0.025856,-0.001711,0.002662,-0.016925,-0.016981,-0.017417,0.016445,0.024613,-0.005655,-0.000102,-0.035872,-0.00301,0.027499,-0.005301,0.0132,-0.007447,0.034083,-0.011217,0.012472,-0.036574,-0.051419,0.006216,-0.040112,-0.024205,-0.033263,0.018183,0.029573,-0.019489,0.023229,-0.000469,-0.007798,-0.011548,-0.006063,0.038874,-0.016854,-0.005688,0.049882,0.034275,0.015515,-0.020991,-0.037905,0.002974,-0.038675,-0.034415,0.004636,-0.056592,-0.028967,-0.045037,-0.007923,0.008608,-0.045638,-0.032225,-0.0227,-0.05686,-0.002395,-0.021572,-0.017763,0.011364,0.000276,-0.08698,-0.004813,-0.037657,-0.056538,-0.018053,0.006022,0.024663,-0.006426,0.047065,-0.015553,-0.003234,-0.059447,0.011738,0.008484,0.002026,0.019506,-0.007386,0.029639,0.028401,0.002235,-0.064656,0.040947,0.001622,0.013812,-0.023292,0.045578,0.008151,-0.038118,0.01387,0.014918,0.052642,0.004307,0.003304,-0.017231,-0.025316,0.018214,-0.010114,-0.059883,-0.03463,-0.006998,-0.050114,0.007769,-0.029005,-0.020084,-0.004642,-0.058653,0.025381,-0.007629,0.024141,0.000765,-0.004676,0.026382,0.031771,0.022182,-0.01327,0.020217,-0.044236,0.000245,0.025963,0.067263,-0.004958,-0.000203,-0.021213,0.05914,-0.041536,0.025339,0.015261,-0.030457,0.047834,-0.008126,-0.011824,-0.035473,0.042637,-0.025757,-0.015534,-0.016704,0.047091,-0.01813,-0.043596,-0.019041,0.042248,0.008002,0.010493,0.047192,0.052626,-0.006313,0.02499,-0.06921,0.050931,0.030441,0.002231,-0.001502,-0.068874,0.062037,-0.020332,0.014853,-0.058465,0.022024,0.027357,-0.050043,-0.019531,0.035727,-0.00418,0.05463,-0.015023,-0.019295,-0.012139,0.027173,0.053078,-0.032403,-0.017049,-0.023024,0.016414,-0.027565,-0.028625,0.057155,0.014574,0.023149,0.028484,-0.015909,0.034407,-0.002258,-0.027343,-0.040181,0.023503,0.015224,-0.024283,0.010302,0.035294,-0.015483,-0.007274,-0.04221,0.047421,0.009666,-0.017197,0.00939,0.016385,0.058245,0.062983,0.007957,-0.002478,0.023748,0.014553,0.019738,-0.035653,-0.021647,-0.049077,0.000618,0.010726,0.032802,0.042578,0.003,-0.004999,0.00337,0.004584,0.034426,0.015803,-0.021904,0.023844,0.052936,0.003452,-0.036806,-0.022045,0.017761,-0.036519,-0.002437,0.001244,0.073,0.013148,0.028743,0.01337,0.039241,0.006586,-0.022856,-0.021094,-0.011564,0.019468,-0.029617,0.015586,0.048728,1.3e-05,0.00992,0.033607,0.029804,-0.021651,0.025961,-0.012116,0.038569,0.021109,-0.037627,-0.026697,-0.028088,-0.011862,0.009554,0.021159,-0.089369,-0.039501,0.022747,-0.058346,-0.023142,0.043369,-0.038996,-0.014924,0.017759,0.02608,-0.050062,0.026792,0.016082,0.025454,0.002192,0.058847,0.045967,0.042447,-0.00603,0.014011,-0.017584,0.02022,0.059751,-0.033384,0.023624,0.06809,0.025808,0.051814,0.049271,-0.001171,0.001943,-0.007358,-0.037597,-0.017007,0.01479,0.01497,0.018021,0.0016,-0.016702,-0.011722,0.023479,0.003894,-0.004195,-0.004744,0.02881,-0.032898]', 'Q1tum9AN7b3s');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('kMw2sFzHS44M', '', 0, 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/.helmignore', '2025-01-11 01:03:30.500928', '# Patterns to ignore when building packages.
# This supports shell glob matching, relative path matching, and
# negation (prefixed with !). Only one pattern per line.
.DS_Store
# Common VCS dirs
.git/
.gitignore
.bzr/
.bzrignore
.hg/
.hgignore
.svn/
# Common backup files
*.swp
*.bak
*.tmp
*.orig
*~
# Various IDEs
.project
.idea/
*.tmproj
.vscode/
', 'This appears to be a `.helmignore` file, not a Kubernetes Group/Version/Kind (GVK) manifest. This is a special file used by Helm to specify which files and directories should be excluded when packaging a chart.

The file contains standard ignore patterns for:

1. System files:
   - `.DS_Store` (macOS system files)

2. Version Control System directories and files:
   - `.git/` and `.gitignore`
   - `.bzr/` and `.bzrignore`
   - `.hg/` and `.hgignore`
   - `.svn/`

3. Common backup/temporary files:
   - `*.swp`
   - `*.bak`
   - `*.tmp`
   - `*.orig`
   - `*~`

4. IDE and editor directories:
   - `.project`
   - `.idea/`
   - `*.tmproj`
   - `.vscode/`

This is a standard `.helmignore` file that helps keep your Helm chart packages clean by excluding unnecessary files during `helm package` operations. It doesn''t contain any variables or Kubernetes resource definitions.', '[0.046897,-0.017246,0.017022,0.013697,0.023472,0.035875,-0.036611,-0.030809,-0.012731,-0.015465,0.023172,-0.033045,0.071722,-0.07596,-0.015867,-0.025238,-0.064133,0.003036,-0.006175,-0.000826,0.012291,-0.022412,0.025229,-0.000554,0.005547,-0.010236,0.041417,-0.014195,0.015032,-0.011149,-0.0364,-0.028466,-0.006695,0.007768,0.026824,0.028868,-0.024052,0.010023,-0.030517,0.016001,0.0073,0.013323,-0.008088,-0.010869,0.001593,-0.014319,-0.011519,0.023663,-0.001124,-0.02626,0.003742,0.044252,0.017212,0.01916,0.024049,0.003961,-0.035529,-0.026455,-0.000815,-0.026842,0.056499,0.05233,0.00876,-0.031047,0.014396,0.040434,-0.028848,-0.035641,0.013676,0.033944,-0.013648,-0.002178,0.027131,-0.041126,0.024587,-0.027667,0.043358,0.030143,0.025279,-0.000304,-0.024848,-0.005771,-0.042758,0.03305,-0.018062,0.019979,0.004191,-0.042992,0.023687,-0.039681,-0.021215,0.037126,0.002616,-0.002942,0.02085,0.004024,-0.017308,-0.010091,0.015043,0.002244,-0.012339,-0.002932,0.035516,0.054322,-0.036794,0.028423,-0.022666,-0.012436,-0.027706,0.028897,-0.034056,0.080279,0.046428,0.052994,-0.051517,-0.022772,0.075605,-0.001192,-0.028807,-0.054246,0.048489,0.014106,0.006474,-0.029174,0.039461,0.01077,0.009886,0.000926,-0.06488,0.020476,0.034126,0.032905,0.028376,-0.007035,0.011507,-0.020127,-0.063895,0.014518,0.011393,-0.015528,0.002896,0.055275,0.048664,-0.012738,0.036245,-0.007671,0.019452,-0.040942,-0.025891,0.03328,0.019352,0.001244,-0.011329,0.054578,0.007753,0.036104,-0.036644,-0.014642,0.051571,-0.016527,0.013334,0.02743,-0.030193,-0.057585,-0.060539,-0.040452,-0.040089,-0.053481,-0.00268,-0.001783,-0.048831,0.037793,0.009765,-0.008395,-0.045601,0.035065,-0.002838,0.026789,0.031178,0.02325,0.009814,0.011469,0.011572,-0.068073,-0.039638,0.00375,0.015358,0.003664,-0.005406,-0.006174,-0.020634,-0.013353,-0.015931,-0.003751,0.002337,-0.005778,-0.018627,0.014374,0.015353,-0.019575,0.002125,0.001156,0.03421,0.006855,0.078331,-0.057975,0.012294,-0.024726,-0.014968,0.028414,-0.024847,-0.03945,-0.017296,-0.01748,0.019417,0.003876,0.010985,-0.032632,-0.07147,0.002044,-0.063638,-0.002081,-0.046772,-0.049166,0.103718,-0.009581,-0.007075,0.033508,0.052144,0.015398,-0.012531,-0.006107,0.022266,0.044096,0.025456,-0.04627,-0.016351,0.06397,-0.007186,-0.027732,-0.012752,-0.025484,-0.014066,-0.021125,0.025098,-0.00531,-0.005278,0.023187,0.017124,0.010752,0.017878,-0.035643,0.01555,-0.026441,0.006459,-0.029813,-0.006855,-0.01826,0.037926,-0.042237,-0.051505,0.005039,-0.034524,-0.035203,-0.000998,0.031485,-0.016867,0.0239,0.035987,0.004512,0.024242,0.001695,-0.025433,-0.010265,0.024677,-0.005647,-0.008272,-0.035739,0.003025,0.013739,-0.045287,0.048416,-0.013102,0.001935,-0.071483,0.019494,0.057071,0.042997,-0.010897,-0.010322,-0.007057,-0.003011,-0.060669,-0.052719,0.024225,-0.00694,-0.055071,0.005063,-0.012466,-0.022627,-0.023979,-0.007518,0.003481,0.044241,0.03178,-0.054053,0.00754,-0.001261,0.065935,-0.00469,-0.006886,0.000843,-0.028448,-0.035486,-0.06007,-0.096428,0.017088,-0.018013,-0.028532,0.006801,-0.020326,0.022572,-0.039812,-0.029843,-0.025519,-0.050606,-0.065172,-0.005348,-0.025308,0.067188,-0.001683,-0.008929,0.007158,0.019225,0.007697,-0.039103,0.002252,-0.095817,0.002008,0.035103,-0.053999,0.022837,0.041865,0.000859,0.008991,0.059012,-0.009459,-0.05021,0.012775,0.023356,0.018627,0.033877,-0.044008,-0.055105,0.080406,-0.007263,-0.021211,-0.031663,0.098542,-0.028958,-0.044542,0.070379,-0.019365,0.01347,-0.026057,-0.000659,0.012408,0.039513,-0.003934,0.024221,0.020378,-0.006371,0.007921,-0.026942,0.010786,0.005702,0.024419,0.05849,0.019082,0.01354,0.04876,-0.019937,0.039295,0.023993,0.000785,-0.03687,0.015432,0.025063,-0.00881,-0.014133,0.04785,-0.026694,0.056467,-0.018161,0.017375,0.008827,-0.017815,-0.043146,0.054765,-0.034161,0.006129,0.02384,-0.022166,-0.011818,0.000463,0.030973,0.038183,0.033008,-0.032234,-0.030826,-0.044742,0.001576,0.009527,-7.6e-05,0.01487,0.028094,0.014734,0.051279,0.014971,-0.006057,0.026476,-0.006727,-0.026893,0.038159,0.029261,0.019158,-0.026867,-0.005858,-0.049178,0.015781,-0.01864,0.022476,-0.033938,0.00266,-0.043744,-0.068275,-0.069428,0.027458,-0.039799,0.023881,-0.008574,0.026327,-0.012597,0.079279,0.017206,0.003096,0.062064,0.045371,-0.001354,0.066395,0.03386,0.002808,0.070942,-0.045292,0.014214,0.023598,0.026636,-0.005185,0.012336,0.000803,0.009162,0.010128,0.013813,0.010306,0.012616,-0.021849,0.04103,0.002969,-0.0074,-0.008624,-0.006081,-0.00246,0.024605,0.025458,0.019773,-0.022777,0.004729,0.008228,-0.007534,-0.033941,-0.006605,0.015405,-0.024053,0.060284,-0.011466,0.019198,0.032399,0.015066,0.068834,-0.030939,0.067023,0.096428,-0.011319,-0.031476,0.019779,-0.009637,0.025208,0.00186,0.046093,-0.002228,-0.006987,-0.035812,0.033725,-0.001407,0.035663,-0.003189,-0.024109,-0.020016,-0.061024,0.062135,0.001246,0.010065,-0.01069,0.04053,-0.002141,-0.011547,0.001275,0.007869,-0.025263,0.030957,-0.017061,0.007577,-0.002468,0.017631,-0.021129,-0.00351,0.058991,0.028343,0.009682,0.038723,-0.021615,-0.005496,0.015629,0.048328,-0.025597,-0.030015,0.016692,-0.024439,-0.036416,0.004863,0.004386,-0.072719,0.058692,-0.00189,0.001586,-0.006278,0.063505,0.03297,0.01169,-0.018865,-0.024199,0.002082,0.028738,-0.001,0.030554,-0.03738,0.000157,0.045983,0.034552,0.020517,-0.021254,-0.032474,0.025044,-0.075873,-0.031561,0.014262,0.018449,-0.031049,0.01828,0.005992,0.015743,-0.004378,0.028877,-0.028458,-0.009355,0.018655,0.020903,-0.026716,-0.03154,-0.038515,-0.017596,0.051722,-0.043853,-0.012658,0.028411,-0.028946,-0.022412,-0.037876,-0.012461,-0.024362,-0.005292,0.067726,0.0028,0.002349,-0.013919,-0.005199,-0.015061,-0.056837,-0.034311,0.064062,0.037114,0.017118,-0.022727,0.012459,-0.014896,-0.043598,-0.000471,-0.023219,0.010883,-0.002926,-0.044266,0.059311,-0.052577,-0.015087,-0.007377,0.008059,0.000245,0.059471,-0.020007,0.010209,0.010801,-0.008765,9.6e-05,-0.01624,-0.025151,0.037598,0.004842,0.014592,-0.010568,-0.008261,-0.008601,-0.033859,-0.090533,0.026674,0.026728,0.016837,-0.041824,-0.031516,-0.019795,-0.018793,-0.017354,0.052645,0.024506,0.027828,0.062786,-0.008751,0.005651,0.026435,0.006657,0.023349,-0.015981,-0.028325,-0.010435,0.010147,-0.048042,0.047781,0.054067,0.008121,0.002363,-0.027478,0.014797,-0.06233,-0.023448,-0.013665,-0.020486,0.007981,0.014353,0.086681,0.038028,-0.03044,-0.003964,-0.006263,0.01121,0.035322,0.013506,0.021699,0.02019,-0.043651,0.000644,0.017469,-0.005836,0.009596,-0.003952,0.048978,0.027024,-0.009726,-0.005766,-0.004765,-0.016046,-0.064096,-0.021499,-0.054568,0.012288,0.019539,0.058458,0.060678,0.000455,-0.022753,0.010143,0.034321,0.025036,0.015878,-0.019211,0.0191,0.007878,-0.032945,0.058867,-0.015251,0.033377,-0.068158,-0.000253,0.006741,-0.006402,0.004015,0.031282,-0.07223,-0.062826,0.006662,-0.042892,0.025159,0.012127,0.000813,-0.030401,-0.006983,0.005418,0.01556,-0.012917,-0.006989,0.019185,-0.030893,-0.033444,0.045916,0.000926,0.029998,-0.023321,-0.006852,-0.000172,-0.011684,0.006155,-0.002778,0.041314,0.037539,-0.002321,-0.053211,-0.046642,0.049115,-0.060837,-0.053137,-0.032244,0.009861,0.027356,-0.043257,0.021198,0.007117,0.04249,-0.026253,-0.013327,-0.018817,0.010558,-0.039464,0.066679,0.019125,0.020611,-0.029132,-0.042115,0.025553,0.023095,-0.033868,-0.019567,-0.034375,-0.017014,-0.014312,-0.020361,0.04377,-0.028359,-0.056143,-0.029643,-0.049604,0.006909,-0.02419,0.011829,-0.005137,0.011381,-0.048879,-0.004915,-0.03516,-0.011824,0.01212,-0.019833,0.008427,0.019986,-0.003792,-0.017495,-0.024707,-0.009588,0.024359,0.014267,-0.004227,0.029082,0.010032,0.01087,0.034913,-0.035945,-0.017829,0.050942,-0.029042,0.016483,-0.027845,0.049558,0.050943,-0.010952,0.012856,-0.015357,0.002107,0.010824,0.004915,-0.058287,-0.04623,0.048744,-0.026285,-0.042584,-0.024124,-0.024842,-0.024068,0.001528,0.012984,-0.015529,0.00362,-0.035578,-0.004629,0.053963,0.014554,-0.005844,-0.053185,-0.013883,-0.020892,0.008275,-0.002507,0.002932,-0.047419,-0.032644,0.033327,0.049038,0.004423,0.00326,-0.030542,0.070804,0.002185,-0.00504,0.009031,-0.032698,0.026282,-0.0199,0.000411,-0.054044,0.059761,-0.040634,0.013958,-0.01199,0.011931,-0.002784,-0.053641,-0.017185,0.010898,0.048755,0.002579,0.075911,0.034998,9e-05,0.006911,-0.063205,0.009895,0.018479,0.025021,0.031753,-0.039102,0.03283,0.004274,0.009427,-0.013057,-0.000275,-0.017787,-0.020981,-0.031303,0.059993,-0.020702,0.049037,-0.039535,0.008549,-0.01157,0.03532,0.042505,-0.023452,-0.027329,-0.003915,0.024746,-0.038172,0.007961,0.072968,0.020098,-0.021915,0.015006,-0.005029,0.015769,-0.002132,-0.013384,-0.010711,0.030462,0.00827,-0.047981,0.008212,0.027513,0.00372,-0.044899,-0.055164,0.006821,0.024687,-0.020832,0.02074,0.025033,0.078833,0.063372,0.016657,0.022881,0.011656,0.028898,0.009499,0.012444,-0.014903,-0.020894,0.034917,0.027715,0.0367,0.030079,0.023972,0.011323,0.029395,0.002711,0.025606,-0.01992,-0.033123,0.021952,0.057356,0.004744,0.005565,0.009903,0.009791,-0.052991,-0.001087,-0.026314,0.032072,-0.002312,-0.016079,-0.002378,0.060165,0.011791,0.006711,-0.028868,-0.002022,0.003347,-0.053091,0.042059,0.066144,0.048288,0.010818,0.021398,-0.00931,-0.032438,0.007031,-0.030568,0.040269,0.018305,-0.02984,-0.017618,-0.046483,-0.021361,0.042226,0.004238,-0.06571,-0.032797,0.046187,-0.055175,-0.025055,5.5e-05,0.023492,-0.016057,-0.021401,-0.005563,-0.016506,-0.004596,0.007298,-0.000793,0.035168,0.03849,0.014778,0.026494,-0.037732,0.01847,-0.003468,0.014719,0.050657,-0.028745,-0.020067,0.048666,-0.009317,0.046445,0.039862,0.011038,0.002383,-0.012908,-0.000761,0.036039,0.000823,0.019373,0.020598,0.030292,-0.021485,-0.004602,0.059137,0.024881,-0.011319,0.008857,0.028857,-0.043037]', 'ibegpY5gg0rT');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('kMw2sFzHS44M', 'chart', 0, 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/Chart.yaml', '2025-01-11 01:03:30.500928', 'apiVersion: v2
name: bootstrap-chart
description: A Helm chart for Kubernetes

# A chart can be either an ''application'' or a ''library'' chart.
#
# Application charts are a collection of templates that can be packaged into versioned archives
# to be deployed.
#
# Library charts provide useful utilities or functions for the chart developer. They''re included as
# a dependency of application charts to inject those utilities and functions into the rendering
# pipeline. Library charts do not define any templates and therefore cannot be deployed.
type: application

# This is the chart version. This version number should be incremented each time you make changes
# to the chart and its templates, including the app version.
# Versions are expected to follow Semantic Versioning (https://semver.org/)
version: 0.0.0

# This is the version number of the application being deployed. This version number should be
# incremented each time you make changes to the application. Versions are not expected to
# follow Semantic Versioning. They should reflect the version the application is using.
# It is recommended to use it with quotes.
appVersion: "0.0.0"

dependencies:
- name: replicated
  repository: oci://registry.replicated.com/library
  version: 1.0.0-beta.32
', 'Here''s a summary of the provided Helm chart''s metadata (Chart.yaml):

- Chart Name: `bootstrap-chart`
- Type: `application` (not a library chart)
- Chart Version: `0.0.0`
- Application Version: `"0.0.0"`

Dependencies:
- Single dependency:
  - Name: `replicated`
  - Repository: `oci://registry.replicated.com/library`
  - Version: `1.0.0-beta.32`

This is a basic application chart with a dependency on a Replicated chart from their OCI registry. The chart and application versions are both set to 0.0.0, suggesting this might be an initial setup or template. The chart follows the standard Helm v2 API version structure.', '[0.033871,-0.010853,0.016346,0.025067,0.019187,0.004239,-0.019976,0.01303,-0.007277,-0.022993,-0.020458,-0.029322,0.054706,0.029391,-0.028145,-0.021716,-0.035053,0.00192,0.028557,0.014319,0.009121,-0.043661,0.008316,0.000561,0.021261,-0.039592,0.057046,0.008487,-0.011577,-0.00771,-0.024028,-0.006146,-0.026049,0.037141,0.020829,0.047198,-0.021364,-0.006131,-0.008833,-0.001948,-0.037476,-0.021839,0.028194,-0.03363,-0.010466,-0.000488,-0.025389,0.00169,-0.020493,-0.047335,0.012264,0.067044,-0.027,-0.007888,-0.025813,0.014797,-0.046264,-0.102538,-0.021329,-0.024451,0.062866,0.021603,-0.001113,-0.007073,0.039042,-0.00224,-0.046247,-0.005334,-0.018253,0.030094,0.003092,-0.000856,0.000693,0.006238,0.013501,-0.006873,0.009532,-0.03657,0.003832,0.006908,-0.021069,-0.025879,-0.020583,0.003023,0.011991,0.003567,-0.027557,0.011306,0.04886,-0.017197,-0.010523,0.057507,0.001916,-0.005667,0.019579,0.016173,-0.024288,-0.01053,-0.005404,0.025345,-0.063617,-0.005456,0.012916,0.048509,-0.022536,0.06007,-0.017207,0.012414,-0.006059,0.011333,-0.025819,0.049737,0.04923,0.027484,-0.075681,-0.044482,0.072634,0.02167,-0.040151,-0.060742,-0.008088,0.013583,0.009327,-0.0478,0.043928,0.011874,0.003755,0.012598,-0.044659,0.024268,-0.005915,0.019577,0.059555,-0.005421,-0.001062,-0.052142,-0.05848,-0.001311,0.034923,-0.005923,-0.0267,0.051812,-0.026765,-0.019316,0.031996,-0.012513,0.005118,-0.032837,-0.010296,-0.013069,0.022627,0.013363,0.027576,-0.000169,0.049901,0.015995,-0.005739,-0.01652,0.042146,0.016183,0.016793,0.019449,-0.005432,-0.022827,-0.013094,-0.039759,-0.028459,-0.049973,-0.020898,-0.02161,-0.041903,0.060435,0.032027,0.038484,0.00176,0.044561,-0.01107,-0.008854,0.027477,-0.001863,-0.014199,0.039493,-0.023023,-0.043071,-0.014831,0.04827,0.024767,-0.007703,0.016712,-0.011584,0.027896,0.045744,0.011423,0.02975,-0.010977,0.007636,-0.004962,0.031225,-0.010436,0.028934,0.016455,0.042913,0.039454,0.021564,0.031799,0.004943,0.014588,-0.030371,-0.014423,0.02674,-0.013844,-0.027513,0.010622,-0.075613,0.017596,0.003648,-0.00121,-0.050029,-0.077103,0.005139,-0.029809,0.004675,-0.034339,-0.040602,0.042857,-0.01463,-0.016516,0.051158,0.0308,-0.00312,-0.017893,0.024198,0.017263,0.045575,0.023825,-0.010879,-0.017227,0.034146,0.010408,0.006101,-0.037245,-0.056496,-0.022282,-0.020198,0.077936,-0.032963,0.041753,-0.002806,0.024613,-0.02832,0.003245,-0.02184,-0.007947,-0.05982,-0.002903,-0.029412,-0.018615,0.015166,0.006826,-0.009612,-0.02025,0.033162,-0.014541,-0.073515,0.015128,0.076808,-0.034549,0.02588,0.050253,-0.006837,0.036105,0.020019,0.006666,0.008228,0.029427,-0.027214,-0.018812,-0.06791,0.012952,-0.015762,-0.047624,0.023908,-0.005372,0.000797,-0.038718,0.036378,0.049508,0.028623,0.019232,-0.008723,0.024434,0.003853,-0.067513,-0.012231,-0.000462,0.001879,-0.072418,0.002071,-0.006118,0.006833,-0.043225,-0.054817,-0.006088,0.039193,-0.005153,-0.039611,0.006542,0.008313,0.079202,-0.003207,0.003057,-0.000502,-0.011854,-0.027717,-0.047327,-0.06519,0.008194,0.003806,0.02628,0.020199,-0.033463,-0.001314,-0.036218,-0.021773,0.024135,-0.041425,-0.012337,-0.027087,-0.042086,0.049171,0.017395,-0.00029,0.006643,-0.007255,0.048423,0.010406,0.013299,-0.078976,0.008835,0.020037,-0.046348,0.031526,0.018268,0.014687,0.030271,0.017279,-0.00314,-0.013761,0.037766,-0.003209,0.005111,0.025997,0.00377,0.007572,0.079941,-0.015385,0.016904,-0.030824,0.072202,-0.010042,0.013769,0.037902,-0.064484,-0.017212,-0.075689,0.04247,0.014743,0.035397,0.006867,0.064986,-0.009415,-0.003996,0.002907,-0.032374,0.00614,0.038304,-0.001126,0.0276,0.019078,0.013104,0.020856,0.000153,0.02865,0.01877,-0.025375,0.027584,0.009792,0.012017,-0.008992,-0.016872,-0.008935,-0.018725,0.00531,-0.023813,-0.01593,0.016639,-0.01549,-0.017373,0.080068,-0.035731,0.001423,-0.00032,0.031973,-0.009535,0.020828,0.02459,0.07662,0.050958,-0.04059,-0.042306,-0.014282,0.002644,-0.001631,0.016812,0.024817,0.048724,0.009564,0.042379,0.006011,-0.016158,0.043544,-0.01987,-0.014404,0.035086,0.008507,0.028458,-0.015187,-0.050451,-0.025716,0.049277,0.026149,0.003425,-0.03627,-0.043844,-0.007916,-0.077625,-0.005254,0.044181,-0.046939,0.007925,0.005937,0.075287,0.006687,0.037166,0.005808,-0.01483,-0.008006,0.033947,-0.022206,0.069447,0.017276,-0.003409,0.041244,-0.021659,0.009636,0.0274,0.032156,-0.026944,0.02043,-0.002874,-0.008057,-0.027403,-0.007607,0.028298,0.013986,-0.026596,0.02843,-0.006546,-0.030993,-0.002092,-0.017419,-0.05216,0.039137,0.015974,0.028429,-0.036601,-0.009051,0.035576,-0.000956,-0.008355,-0.040523,0.036762,-0.011269,0.0596,-0.013082,-0.025385,0.026899,0.038252,0.066131,-0.023393,0.064587,0.076397,-0.006476,-0.044855,0.002107,0.037732,0.032904,0.028603,-0.01443,-0.005962,-0.001871,-0.02841,0.030416,0.043134,0.041437,-0.042807,0.071164,-0.026949,-0.031816,0.048521,0.003161,0.012141,-0.037039,0.067414,-0.020266,0.028069,0.007845,0.015944,-0.005752,0.022818,-0.044492,0.012979,-0.034087,-0.040808,-0.015917,0.012374,0.012372,0.00022,-0.006849,-0.001558,0.005672,-0.01588,-0.004139,-0.013263,-0.007978,-0.015948,0.012115,-0.021618,-0.00967,0.018469,0.053043,-0.046899,-0.003739,-0.018778,0.010138,-0.010316,-0.007019,0.014975,-0.014525,0.038105,-0.050349,0.031934,0.024836,-0.028465,0.031721,-0.012108,0.020429,0.061752,0.037717,0.000204,-0.005799,-0.020627,0.020603,-0.066252,-0.013099,-0.001261,-0.014822,0.01498,0.01811,-0.012487,0.001727,0.005063,0.054164,-0.020267,-0.036769,0.011636,0.030736,-0.026939,0.027024,-0.048998,-0.013114,0.027189,-0.05313,-0.027536,-0.008447,0.013861,-0.05726,-0.017142,-0.010642,0.007471,-0.006549,0.057146,-0.020433,-0.048253,-0.012163,-0.039895,0.018146,-0.084705,0.002346,0.036696,0.002007,-0.02778,-0.033357,0.034997,-0.014492,-0.073597,0.011501,-0.008736,0.042407,0.004668,-0.066485,0.048422,-0.043015,-0.030491,-0.016539,-0.021198,-0.03976,0.09678,-0.02279,-0.006935,0.010306,0.013924,-0.013904,-0.023416,-0.012833,0.044474,-0.012801,-0.017498,-0.03312,-0.007847,-0.01876,-0.050146,-0.030059,-0.006314,0.025243,0.029685,-0.055752,-0.025221,-0.029642,0.020432,0.010814,0.021326,0.019041,0.017283,0.070281,0.030117,0.027143,0.056046,0.018776,0.012183,0.013376,-0.016481,0.016827,0.00732,-0.073121,0.051801,0.022712,-0.006287,0.042371,-0.046641,-0.001618,-0.069527,-0.026037,-0.03641,-0.010779,-0.02508,0.006228,0.05339,0.044041,-0.038988,0.015895,-0.009262,0.005764,0.040287,0.006819,0.010125,0.001834,-0.07086,0.010761,0.02257,-0.049313,0.007529,-0.029557,0.040114,0.011113,0.004415,0.014733,-0.000749,0.008262,-0.059329,0.010747,0.001203,-0.02337,-0.009471,0.060946,0.013507,-0.028595,-0.034037,0.032783,0.058408,0.04375,-0.009557,-0.06087,0.056668,-0.045109,-0.043254,0.090979,-0.025149,0.00302,-0.022151,-0.036435,-0.025359,0.024754,0.0333,0.016943,-0.019638,0.00193,0.030873,-0.021757,0.019779,-0.001532,0.005322,-0.02887,0.007124,0.008172,-0.012329,0.007906,-0.008968,-0.022952,-0.027673,-0.005,0.050499,0.013076,0.009213,-0.036882,0.004956,0.037285,-0.014209,0.008456,-0.005926,0.040445,0.019601,0.025585,-0.033607,-0.045818,-0.002007,-0.025424,-0.030073,-0.038966,-0.001343,0.021062,-0.027998,0.021821,-0.009245,-0.016015,0.002325,-0.014017,0.013963,-0.026091,0.002118,0.034582,0.022435,0.029605,-0.006503,-0.042694,-0.00123,-0.035674,-0.019286,-0.018495,-0.064282,-0.023651,-0.052475,-0.014134,0.008417,-0.065201,-0.025771,-0.006252,-0.065867,0.006419,0.003946,0.008557,-0.014369,-0.014333,-0.085159,-0.042616,-0.037538,-0.053614,-0.001702,-0.021131,0.039653,0.02369,0.053432,-0.007179,-0.012447,-0.042279,0.006723,0.013173,0.011256,0.0245,0.007064,0.018159,0.0076,0.000795,-0.07319,0.036126,0.002136,0.00812,-0.019404,0.037673,0.005916,-0.041023,0.006547,-0.008254,0.025795,0.022873,0.01838,-0.052477,-0.02976,0.025408,-0.01423,-0.032673,-0.048464,-0.027466,-0.050705,-0.005296,-0.017627,-0.028962,0.010459,-0.034983,0.021511,0.009868,0.024663,0.004734,-0.019787,-0.019245,0.037416,0.029945,-0.047913,0.019448,-0.044176,-0.013303,0.025609,0.043908,0.002945,-0.009871,-0.049226,0.054725,-0.040322,0.006422,0.027084,-0.025244,0.026967,0.00912,-0.013321,-0.025409,0.043463,-0.023087,-0.015236,-0.016296,0.043544,-0.04983,-0.016021,-0.031869,0.038388,-0.000595,-0.011978,0.02708,0.062986,-0.001897,0.02056,-0.071834,0.033787,0.022207,-0.016443,-0.001177,-0.061173,0.052353,0.003655,0.012814,-0.05145,0.04022,0.028898,-0.024295,-0.020883,0.027912,-0.029574,0.039353,-0.013034,-0.022919,-0.001003,0.020703,0.04583,-0.038059,-0.010168,-0.030907,0.020849,-0.027013,-0.033687,0.06257,0.009513,0.015955,0.023537,-0.041691,0.033035,-0.001961,-0.028579,-0.062896,0.01107,0.004089,-0.022126,0.020766,0.056822,-0.002252,0.014589,-0.046673,0.053259,0.005408,-0.030702,0.012549,0.0028,0.048987,0.054447,0.018176,0.000369,0.019663,0.026976,0.04109,-0.032952,-0.012141,-0.011129,0.012816,0.025442,0.044967,0.035681,-0.009058,-0.005803,-0.007323,0.008855,0.041625,-0.008321,-0.028527,0.010049,0.046687,0.008638,-0.026653,-0.025006,0.014431,-0.046491,5.7e-05,0.022424,0.054095,9.4e-05,0.01564,0.027982,0.040224,0.004005,-0.032489,-0.010319,-0.022996,-0.038269,-0.022265,-0.002207,0.038873,-0.009962,-0.006762,0.046897,0.013998,-0.037651,0.030567,-0.011818,0.031966,0.037143,-0.038811,-0.020502,-0.014919,-0.011547,0.01173,0.008374,-0.094362,-0.040654,0.013755,-0.084862,-0.022701,0.03092,-0.004799,-0.017678,-0.011073,0.017403,-0.047597,0.018445,0.022311,0.001328,-0.018007,0.062893,0.038263,0.013846,0.005256,0.021278,-0.00475,-0.005827,0.052098,-0.020462,0.014454,0.054105,0.024857,0.053978,0.043002,-0.011954,0.015126,-0.029991,-0.036117,-0.006607,0.016171,0.004184,0.025753,0.018592,-0.032544,0.006055,0.011474,0.001326,0.008931,-0.005532,0.00688,-0.038948]', 'V1oDx3fRfqIx');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('kMw2sFzHS44M', '', 0, 'go/src/github.com/replicatedhq/chartsmith/bootstrap-chart/templates/NOTES.txt', '2025-01-11 01:03:30.500928', 'You''ve installed the app.
', 'I don''t see any Helm chart or Kubernetes resource definition (GVK - Group/Version/Kind) provided in your message. Could you please share the YAML content you''d like me to analyze? Once you share it, I can help summarize all the names, variables, and configurations it uses.', '[0.015926,-0.033506,0.013551,-0.018593,0.023254,0.025314,-0.014376,-0.028211,-0.008134,-0.010764,-0.010266,-0.057276,0.038776,0.040234,-0.004493,-0.024546,-0.055013,-0.016075,0.032785,0.002642,0.022525,-0.059728,-0.020334,0.025651,0.010649,0.042748,0.008891,0.005289,0.008351,-0.034577,-0.043234,0.017357,-0.0135,0.011968,0.026207,0.065609,-0.018339,0.048945,-0.019388,-0.017137,-0.028041,0.010224,0.020352,0.026798,-0.018838,-0.005008,0.0061,0.032886,-0.03646,-0.014218,0.032257,0.022116,0.002328,0.00858,0.009986,-0.016695,-0.040539,-0.047304,0.011712,0.017071,0.038999,-0.001254,0.009705,-0.0084,0.002689,0.011063,-0.050391,0.009735,-0.04593,0.046453,0.010762,0.011944,0.014842,0.012425,0.023373,0.007736,0.009029,0.009916,0.01633,0.078518,-0.016645,-0.020464,-0.049694,0.020992,-0.030396,0.010735,-0.060334,-0.009069,0.062076,-0.017271,-0.002853,0.026855,0.037543,0.026165,0.009943,0.030922,-0.022415,-0.036241,0.021935,0.004158,-0.019527,-0.016689,0.02575,0.042783,-0.031626,0.014721,-0.018206,-0.017472,0.019031,0.018407,-0.008328,0.041849,0.054525,0.05681,-0.052618,-0.039627,0.029423,0.04339,-0.017289,-0.027503,0.01156,0.039097,0.048524,-0.055333,-0.023129,0.013165,-0.016606,0.029118,-0.062969,-0.040691,0.0219,-0.003268,0.02516,-0.00351,0.020425,-0.044183,-0.080971,0.023252,0.071503,-0.011099,-0.046137,0.018215,0.002108,-0.006945,0.000151,0.003751,0.034013,-0.002987,-0.009416,0.00109,-0.021555,0.029166,0.031034,-0.003816,0.014013,0.05472,-0.025746,-0.052536,0.020874,0.009394,0.009147,0.024775,-0.012987,-0.003881,-0.026881,-0.009557,-0.051586,-0.018746,0.01496,-0.018979,-0.011212,-0.03016,0.002945,0.024577,0.004521,0.075967,0.000438,0.018945,-0.001389,0.005516,-0.006216,0.006816,-0.027413,-0.020932,-0.016495,0.058415,0.015738,-0.063978,-0.006878,-0.035117,0.006522,0.03832,0.040696,0.0137,-0.012624,-0.020362,-0.00503,0.003123,0.004345,0.003594,-0.001716,0.035769,0.043816,-0.008571,0.020473,-0.012168,0.000354,-0.015849,0.005325,0.073981,-0.044436,-0.030671,-0.059554,-0.061756,-0.004395,-0.033214,0.019102,-0.023396,-0.087405,-9.9e-05,-0.032538,-0.007364,-0.011664,-0.050254,0.051786,-0.028521,-0.013475,0.045783,0.023717,0.049155,0.011064,0.036939,-0.020381,0.048556,-0.006871,-0.003978,-0.030919,0.06199,-0.034121,-0.011522,-0.003294,-0.018565,-0.020321,-0.015386,0.036289,-0.03785,-0.013988,0.044013,0.05466,-0.046906,-0.010114,0.032282,0.036663,-0.038045,0.029248,-0.046238,0.009191,-0.021645,-0.008255,-0.000609,-0.008057,-0.046072,0.029932,-0.051356,0.008995,0.071436,-0.002651,-0.010359,0.044259,0.015928,-0.02422,0.032808,-0.037614,0.044588,0.020883,-0.014262,-0.003652,-0.048666,-0.007479,-0.010913,-0.028188,0.004618,-0.046592,-0.007168,-0.026238,-0.01062,0.019371,0.013228,0.016967,0.013337,0.000574,0.030688,-0.064895,0.001876,0.010007,0.003917,-0.003465,-0.004101,0.052522,-0.021567,0.010393,-0.011913,-0.003462,0.057198,0.009409,-0.042147,0.001432,0.005081,0.056765,-0.001743,0.02164,-0.017333,-0.040935,-0.01002,-0.078524,-0.077053,0.026928,0.021229,0.011482,0.057284,-0.015845,0.021338,-0.011093,-0.012078,0.017934,-0.080686,-0.010793,-0.045042,-0.034328,0.051169,0.010459,-0.035045,0.03938,-0.043141,0.00956,0.03391,0.017249,-0.086673,-0.007643,-0.003104,-0.061007,-0.000493,0.019653,0.005147,0.050744,0.049702,-0.051869,0.004268,0.022035,0.018857,-0.00652,0.030742,-0.003733,-0.005116,0.037139,0.000139,0.017145,0.012269,0.037155,-0.030025,-0.002868,0.033705,-0.026188,-0.043241,-0.008646,0.020915,0.018541,0.05518,-0.031596,0.029459,0.021508,-0.005437,0.010043,-0.008074,-0.027834,0.009972,-0.021333,0.053738,0.070011,0.036235,-0.001338,0.022494,0.017756,-0.022152,0.001977,0.041277,0.002111,0.016054,-4.1e-05,-0.016147,0.022835,-0.024571,0.009859,0.007133,-0.009822,0.004271,0.010729,-0.009969,0.066675,-0.01208,0.027285,0.024154,0.045506,-0.032633,0.014883,-0.004895,0.068164,0.000232,-0.04057,0.017752,-0.053691,-0.01783,-0.012776,0.059769,0.023658,0.021946,0.026582,0.029379,0.034773,-0.019526,0.033007,0.016543,-0.004923,0.031638,-0.010949,0.044564,-0.006999,-0.018822,0.02852,0.019224,0.039581,-0.014168,-0.015381,-0.049254,-0.013056,-0.045357,-0.030137,0.05494,-0.08114,0.029305,-0.02526,0.023672,-0.001143,0.02561,0.033999,-0.028077,0.033987,0.00696,-0.016372,0.065596,0.018765,0.025585,0.019043,-0.086284,0.005185,-0.010699,-0.02002,-0.007887,0.07638,-0.020895,-0.000103,-0.015149,0.022366,0.013363,0.016992,-0.003305,0.057747,-0.002053,-0.014299,-0.008062,-0.027355,-0.025346,-0.00586,0.038022,0.027821,-0.031797,0.02787,0.010857,0.031223,-0.022344,-0.024747,0.021322,0.013475,0.041488,-0.03333,0.011677,0.00937,0.019375,0.013133,-0.020649,0.101247,0.054228,0.029069,-0.028186,0.026584,0.027784,0.044856,0.017951,-0.005902,0.042163,-0.015145,-0.018826,0.012767,0.004514,0.024794,-0.023712,0.042818,-0.030578,-0.061168,0.02629,0.023822,0.01317,-0.024688,0.026059,-0.029683,-0.031804,-0.000568,0.034004,-0.023385,0.010592,-0.06355,0.044503,-0.017704,0.043345,-0.010382,0.004917,0.048847,0.064743,0.012871,-0.006346,0.01604,-0.0254,-0.028075,-0.00351,0.022907,0.00449,0.019757,-0.000124,-0.053124,0.008202,0.050806,-0.036236,0.009583,-0.01217,0.016006,0.002214,0.071884,0.02523,0.002939,0.015662,-0.034326,0.009947,0.098342,-0.015287,0.02759,0.012897,0.026535,-0.018251,0.020389,-0.003934,-0.01137,-0.008952,0.042841,-0.025728,-0.041654,-0.001828,0.034037,-0.010847,0.011224,-0.063944,0.005595,-0.007088,0.017173,-0.026357,0.020285,-0.019905,-0.000217,0.049514,-0.041853,-0.042613,0.001029,-0.000124,-0.022793,-0.007326,0.010061,-0.005385,-0.043761,0.001124,-0.037071,0.005966,-0.063236,0.063095,0.009571,-0.014434,-0.037642,0.009039,0.003258,-0.028868,-0.032757,-0.001054,-0.018443,0.012592,-0.00742,0.0155,0.039436,-0.037075,0.018318,-0.050555,0.008613,0.028065,-0.024994,0.040379,-0.019423,0.010675,0.019939,0.017656,-0.007109,0.066652,-0.013628,-0.002366,0.009327,-0.022046,0.027028,-0.02033,-0.002118,-0.016195,0.009505,0.017893,-0.031146,0.006757,-0.03221,-0.065934,-0.027918,-0.016599,0.034079,0.021668,-0.030409,-0.016734,-0.031876,-0.006657,-0.001844,0.036646,0.009548,0.013382,0.072877,-0.00786,0.065297,0.045235,-0.010677,0.017869,-0.00864,0.016899,0.009444,-0.004438,-0.031836,0.079837,0.013161,0.027307,0.007978,-0.029353,-0.022714,-0.074978,-0.028786,-0.021002,-0.025959,-0.051584,0.01109,0.043779,0.020319,0.010056,-2e-05,-0.014492,-0.03183,0.013768,-0.005751,-0.010987,-0.032784,-0.031326,0.00868,0.037428,0.00476,-0.031903,-0.030576,0.021659,0.006655,-0.002904,0.025731,0.004035,0.010947,-0.005398,-0.01978,0.002857,-0.048542,-0.040672,0.068672,-0.001042,-0.045238,0.012079,0.025304,0.025681,0.033948,0.028659,-0.041685,0.013373,-0.059417,-0.030814,0.076354,0.012582,0.000481,-0.054359,-0.030647,0.017561,0.029574,0.026922,0.017215,-0.002787,-0.018213,-0.019082,-0.03767,0.036385,0.010237,0.009909,0.011515,-0.01953,0.012237,0.028298,-0.012744,-0.029938,0.003676,-0.055291,-0.038402,0.050874,0.013267,0.003359,-0.010933,0.005745,0.021704,0.035003,0.004358,0.018366,0.014277,-0.01716,0.003241,-0.072151,0.014155,0.060902,-0.014667,-0.025383,-0.014562,0.011586,-0.003238,-0.031565,0.023029,-0.035339,0.051079,0.043754,-0.010633,0.009725,-0.009813,-0.018584,0.06134,-0.004889,0.021737,-0.018639,-0.051843,0.025865,0.026185,-0.042929,0.015607,-0.084014,-0.045229,-0.060756,-0.025728,-0.017873,-0.01511,-0.000491,-0.026961,-0.060093,-0.019949,0.000531,0.013701,0.007772,-0.013372,-0.075583,0.017671,-0.02694,-0.050429,-0.014975,0.014127,0.004197,0.009425,0.052303,-0.032784,0.019692,-0.030979,0.026487,-0.005318,0.001836,0.023757,0.013723,0.024256,0.033175,-0.009804,-0.02565,0.010309,-0.054141,0.02402,-0.000954,0.023124,0.002564,-0.008492,-0.034876,-0.007222,0.034138,0.029001,0.021214,-0.01543,-0.003782,0.027222,-0.007799,-0.016197,-0.049385,-0.021726,-0.030835,0.016972,0.002063,-0.006465,-0.005307,-0.01917,0.007643,-0.025162,0.00406,0.017008,0.013386,-0.0141,0.003642,0.030681,-0.047704,0.054505,-0.023243,0.024927,-0.009925,0.05183,0.009803,-0.02601,-0.040818,0.028016,-0.0624,0.033136,-0.009358,-0.013896,0.005512,-0.023576,0.020995,-0.011359,0.054364,-0.084066,0.017248,0.031209,0.003471,-0.050963,-0.053163,-0.025312,0.037185,-0.007489,0.037722,-0.013957,0.015707,0.000424,-0.019703,-0.094981,0.027163,0.022786,0.020154,-0.019218,-0.027589,0.000635,0.00929,0.012902,-0.055441,0.022469,0.018806,-2.5e-05,-0.017185,-0.005773,-0.041463,0.019438,-0.063509,0.005025,-0.003041,0.027144,0.02342,-0.036588,-0.030039,0.023695,0.039462,-0.016341,-0.005775,0.055253,0.021997,-0.005334,0.021185,-0.000878,0.052649,-0.019813,-0.007738,-0.037346,0.05892,-0.009546,-0.079544,0.003201,0.003032,-0.009452,0.027836,-0.019622,0.028219,0.015955,-0.039049,-0.011305,0.044332,0.042194,0.086521,0.006721,0.004941,0.01246,0.013863,0.02152,-0.025421,-0.03646,-0.043463,-0.011321,-0.003032,-0.011437,0.027637,-0.040333,0.015351,-0.014728,0.025357,0.010519,-0.015489,-0.006186,-0.00139,0.057874,-0.004474,-0.001933,-0.008359,0.022103,-0.048851,-0.001728,-0.011178,0.095656,0.001731,-0.028915,-0.019477,0.06611,-0.008896,-0.001552,-0.017406,-0.034543,0.048554,-0.05266,0.023956,0.037814,-0.015485,0.029561,0.026289,0.000395,-0.017655,0.032142,-0.020891,-0.015107,0.020896,0.002056,0.000623,-0.049893,0.01655,0.006855,0.011357,-0.05899,-0.010024,0.036284,-0.035316,-0.041847,-0.035196,0.010957,0.014819,0.013716,-0.00418,-0.057697,-0.019023,0.039649,0.035288,-0.016681,0.018266,-0.013239,0.011729,0.012418,0.010085,-0.001898,0.036317,0.075975,-0.001745,0.033462,0.022269,0.094886,0.0281,0.030553,-0.028105,0.032983,-0.009373,-0.043526,0.014106,-0.027802,0.031964,-0.010303,0.017273,-0.026983,0.070886,0.060058,0.034785,-0.042266,0.024081,0.03179,-0.027528]', 'vStfRZsIaLy1');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('workspace0001', 'chart', 1, 'Chart.yaml', '2025-01-11 01:03:36.014264', 'apiVersion: v2
name: wordpress
description: A Helm chart for WordPress with MySQL
type: application
version: 0.1.0
appVersion: "6.4.1"

dependencies:
- name: replicated
  repository: oci://registry.replicated.com/library
  version: 1.0.0-beta.32', NULL, NULL, '074226e09a3cf1ddc78f3af2');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('workspace0001', 'values', 1, 'values.yaml', '2025-01-11 01:03:36.014264', '# WordPress Application Configuration
wordpress:
  # Image configuration for WordPress
  image:
    # Repository path for the image
    repository: proxy.replicated.com/appslug
    # Image name without repository and tag
    name: wordpress
    # Image tag version
    tag: "6.4.1-apache"
    # Image pull policy
    pullPolicy: IfNotPresent

  # Image pull secrets configuration
  imagePullSecrets:
    - name: replicatedsecret

  # Service configuration
  service:
    type: ClusterIP
    port: 80

  # Storage configuration for WordPress
  persistence:
    enabled: true
    size: 10Gi
    storageClass: ""

  # Resource limits and requests
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi

# MySQL Database Configuration
mysql:
  # Image configuration for MySQL
  image:
    repository: proxy.replicated.com/appslug
    name: mysql
    tag: "8.0"
    pullPolicy: IfNotPresent

  # Service configuration
  service:
    port: 3306

  # Storage configuration for MySQL
  persistence:
    enabled: true
    size: 8Gi
    storageClass: ""

  # Resource configuration
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi

# Ingress Configuration
ingress:
  enabled: false
  className: "nginx"
  annotations: {}
  hosts:
    - host: wordpress.local
      paths:
        - path: /
          pathType: Prefix

# Global configurations
serviceAccount:
  create: true
  automount: true
  annotations: {}
  name: ""', NULL, NULL, 'f946a05d35987ddde9862fa9');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('workspace0001', '', 1, 'templates/_helpers.tpl', '2025-01-11 01:03:36.014264', '{{/*
Expand the name of the chart.
*/}}
{{- define "wordpress.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "wordpress.fullname" -}}
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
{{- define "wordpress.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "wordpress.labels" -}}
helm.sh/chart: {{ include "wordpress.chart" . }}
{{ include "wordpress.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "wordpress.selectorLabels" -}}
app.kubernetes.io/name: {{ include "wordpress.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "wordpress.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "wordpress.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}', NULL, NULL, 'debe59e1c2357d42f391cc77');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('workspace0001', 'apps/v1/Deployment', 1, 'templates/wordpress-deployment.yaml', '2025-01-11 01:03:36.014264', 'apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "wordpress.fullname" . }}-wordpress
  labels:
    {{- include "wordpress.labels" . | nindent 4 }}
    app.kubernetes.io/component: wordpress
spec:
  replicas: 1
  selector:
    matchLabels:
      {{- include "wordpress.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: wordpress
  template:
    metadata:
      labels:
        {{- include "wordpress.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: wordpress
    spec:
      {{- with .Values.wordpress.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: wordpress
          image: "{{ .Values.wordpress.image.repository }}/{{ .Values.wordpress.image.name }}:{{ .Values.wordpress.image.tag }}"
          imagePullPolicy: {{ .Values.wordpress.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
          volumeMounts:
            - name: wordpress-data
              mountPath: /var/www/html
          resources:
            {{- toYaml .Values.wordpress.resources | nindent 12 }}
      volumes:
        - name: wordpress-data
          persistentVolumeClaim:
            claimName: {{ include "wordpress.fullname" . }}-wordpress', NULL, NULL, '02cc296c0665c3934bcfdeb7');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('workspace0001', 'v1/PersistentVolumeClaim', 1, 'templates/wordpress-pvc.yaml', '2025-01-11 01:03:36.014264', 'apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "wordpress.fullname" . }}-wordpress
  labels:
    {{- include "wordpress.labels" . | nindent 4 }}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: {{ .Values.wordpress.persistence.size }}
  {{- if .Values.wordpress.persistence.storageClass }}
  storageClassName: {{ .Values.wordpress.persistence.storageClass }}
  {{- end }}', NULL, NULL, '3e80e8a307b70677e2033085');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('workspace0001', 'v1/Service', 1, 'templates/wordpress-service.yaml', '2025-01-11 01:03:36.014264', 'apiVersion: v1
kind: Service
metadata:
  name: {{ include "wordpress.fullname" . }}-wordpress
  labels:
    {{- include "wordpress.labels" . | nindent 4 }}
    app.kubernetes.io/component: wordpress
spec:
  type: {{ .Values.wordpress.service.type }}
  ports:
    - port: {{ .Values.wordpress.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "wordpress.selectorLabels" . | nindent 4 }}
    app.kubernetes.io/component: wordpress', NULL, NULL, '49aeaa37e5dde214a5eb1ee4');
INSERT INTO workspace_gvk (workspace_id, gvk, revision_number, file_path, created_at, content, summary, embeddings, id) VALUES ('workspace0001', 'networking.k8s.io/v1/Ingress', 1, 'templates/ingress.yaml', '2025-01-11 01:03:36.014264', '{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "wordpress.fullname" . }}
  labels:
    {{- include "wordpress.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "wordpress.fullname" $ }}-wordpress
                port:
                  number: {{ $.Values.wordpress.service.port }}
          {{- end }}
    {{- end }}
{{- end }}', NULL, NULL, '6da5cfea4e8d2dd0a4b97cb1');
