import { Webview } from 'vscode';
import { Centrifuge } from 'centrifuge';
import * as http from 'http';

export interface WorkspaceMapping {
  localPath: string;       // Local directory path
  workspaceId: string;     // ChartSmith workspace ID
  lastUpdated: string;     // Timestamp of last update
}

export interface AuthData {
  token: string;
  apiEndpoint: string;
  pushEndpoint: string;
  userId: string;
  wwwEndpoint: string;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting'
}

export interface GlobalState {
  webviewGlobal: Webview | null;
  centrifuge: Centrifuge | null;
  connectionStatus: ConnectionStatus;
  reconnectAttempt: number;
  reconnectTimer: NodeJS.Timeout | null;
  authData: AuthData | null;
  isLoggedIn: boolean;
  authServer: http.Server | null;
  centrifugoJwt: string | null;
}