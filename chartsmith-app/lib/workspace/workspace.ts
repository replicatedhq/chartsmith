import { getDB } from "../data/db";
import { getParam } from "../data/param";
import { FileNode } from "../types/files";
import { Workspace } from "../types/workspace";
import * as srs from "secure-random-string";

export async function createWorkspace(name: string, createdType: string, prompt: string | undefined, userId: string): Promise<Workspace> {
  try {
    const id = srs.default({ length: 12, alphanumeric: true });
    const db = getDB(await getParam("DB_URI"));
    const initialFiles = getInitialWorkspaceFiles();

    // Start transaction
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Create workspace
      await client.query(
        `INSERT INTO workspace (id, created_at, last_updated_at, name, created_by_user_id, created_type, prompt, current_revision_number)
        VALUES ($1, now(), now(), $2, $3, $4, $5, 0)`,
        [id, name, userId, createdType, prompt]
      );

      // Insert all files in the same transaction
      for (const file of initialFiles) {
        await client.query(
          `INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name)
          VALUES ($1, $2, 0, now(), now(), $3, $4)`,
          [id, file.path, file.content, file.name]
        );
      }

      // add the first chat message
      if (createdType === "prompt") {
        await client.query(
          `INSERT INTO workspace_chat (workspace_id, created_at, sent_by, content, is_complete)
          VALUES ($1, now(), $2, $3, true)`,
          [id, "user", prompt]
        );
      }

      // Commit transaction
      await client.query('COMMIT');

      return {
        id: id,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        name: name
      };
    } catch (err) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      throw err;
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}


function getInitialWorkspaceFiles(): FileNode[] {
  return [
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
}
