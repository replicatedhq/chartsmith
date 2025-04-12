import { AuthData, GlobalState } from '../../types';
import { fetchApi } from '../api';

let globalState: GlobalState;

export function initRenders(state: GlobalState): void {
  globalState = state;
}

export async function fetchWorkspaceRenders(
  authData: AuthData,
  workspaceId: string
): Promise<any[]> {
  try {
    console.log(`Fetching renders for workspace: ${workspaceId}`);
    const response = await fetchApi(
      authData,
      `/workspace/${workspaceId}/renders`,
      'GET'
    );
    
    console.log('API response for renders:', response);
    console.log('RAW API RESPONSE for renders: ' + JSON.stringify(response));
    
    // Handle different response structures
    if (Array.isArray(response)) {
      console.log(`Found ${response.length} renders in direct array response`);
      return response;
    }
    
    // If the API returns an object with a renders property
    if (response.renders) {
      console.log(`Found ${response.renders.length} renders in response.renders`);
      return response.renders;
    }
    
    console.log('No renders found in response');
    return [];
  } catch (error) {
    console.error('Error fetching workspace renders:', error);
    return [];
  }
}

export function handleRenderMessage(data: any): void {
  // Handle incoming render messages from WebSocket
  if (data.type === 'render' && data.workspaceId) {
    // Process the render
    console.log('Received render message:', data);

    // Post to webview if available
    if (globalState?.webviewGlobal) {
      globalState.webviewGlobal.postMessage({
        command: 'newRender',
        render: data
      });
    }
  }
}