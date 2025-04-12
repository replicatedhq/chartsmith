import { AuthData, GlobalState } from '../../types';
import { fetchApi } from '../api';

let globalState: GlobalState;

export function initChat(state: GlobalState): void {
  globalState = state;
}

export async function fetchWorkspaceMessages(
  authData: AuthData,
  workspaceId: string
): Promise<any[]> {
  try {
    console.log(`Fetching messages for workspace: ${workspaceId}`);
    const response = await fetchApi(
      authData,
      `/workspace/${workspaceId}/messages`,
      'GET'
    );
    
    console.log('API response for messages:', response);
    console.log('RAW API RESPONSE: ' + JSON.stringify(response));
    
    // The API returns an array directly, not an object with a messages property
    if (Array.isArray(response)) {
      console.log(`Found ${response.length} messages in direct array response`);
      return response;
    }
    
    // Backwards compatibility for if the API returns an object with a messages property
    if (response.messages) {
      console.log(`Found ${response.messages.length} messages in response.messages`);
      return response.messages;
    }
    
    console.log('No messages found in response');
    return [];
  } catch (error) {
    console.error('Error fetching workspace messages:', error);
    return [];
  }
}

export async function sendMessageToWorkspace(
  authData: AuthData,
  workspaceId: string,
  message: string
): Promise<any> {
  try {
    return await fetchApi(
      authData,
      `/workspace/${workspaceId}/messages`,
      'POST',
      {
        content: message
      }
    );
  } catch (error) {
    console.error('Error sending message to workspace:', error);
    throw error;
  }
}

export function handleChatMessage(data: any): void {
  // Handle incoming chat messages from WebSocket
  if (data.type === 'message' && data.workspaceId) {
    // Process the message
    console.log('Received chat message:', data);

    // Post to webview if available
    if (globalState?.webviewGlobal) {
      globalState.webviewGlobal.postMessage({
        command: 'newMessage',
        message: data
      });
    }
  }
}