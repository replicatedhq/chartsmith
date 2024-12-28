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

      await client.query(
        `INSERT INTO workspace (id, created_at, last_updated_at, name, created_by_user_id, created_type, prompt, current_revision_number, is_initialized)
        VALUES ($1, now(), now(), $2, $3, $4, $5, 0, false)`,
        [id, name, userId, createdType, prompt]
      );

      for (const file of initialFiles) {
        await client.query(
          `INSERT INTO workspace_file (workspace_id, file_path, revision_number, created_at, last_updated_at, content, name)
          VALUES ($1, $2, 0, now(), now(), $3, $4)`,
          [id, file.path, file.content, file.name]
        );
      }

      let chatId: string = srs.default({ length: 12, alphanumeric: true });
      if (createdType === "prompt") {
        await client.query(
          `INSERT INTO workspace_chat (id, workspace_id, created_at, sent_by, prompt, response, is_complete, is_initial_message)
          VALUES ($1, $2, now(), $3, $4, null, false, true)`,
          [chatId, id, userId, prompt]
        );
      }

      await client.query(`SELECT pg_notify('new_chat', $1)`, [chatId]);

      await client.query('COMMIT');

      return {
        id: id,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        name: name,
        files: [],
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

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  try {
    const db = getDB(await getParam("DB_URI"));
    const result = await db.query(
      `
            SELECT
                workspace.id,
                workspace.created_at,
                workspace.last_updated_at,
                workspace.name,
                workspace.created_by_user_id,
                workspace.created_type,
                workspace.prompt,
                workspace.current_revision_number,
                workspace.is_initialized
            FROM
                workspace
            WHERE
                workspace.id = $1
        `,
      [id]
    );

    if (result.rows.length === 0) {
      return;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      createdAt: row.created_at,
      lastUpdatedAt: row.last_updated_at,
      name: row.name,
      files: [],
    };
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
