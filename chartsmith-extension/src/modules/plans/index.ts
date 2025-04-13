import { AuthData, GlobalState } from '../../types';
import { fetchApi } from '../api';
import { Plan } from '../../state/atoms';

let globalState: GlobalState;

export function initPlans(state: GlobalState): void {
  globalState = state;
}

export async function fetchWorkspacePlans(
  authData: AuthData,
  workspaceId: string
): Promise<Plan[]> {
  try {
    console.log(`Fetching plans for workspace: ${workspaceId}`);
    const response = await fetchApi(
      authData,
      `/workspace/${workspaceId}/plans`,
      'GET'
    );
    
    console.log('API response for plans:', response);
    console.log('RAW API RESPONSE for plans: ' + JSON.stringify(response));
    
    // Handle different response structures
    if (Array.isArray(response)) {
      console.log(`Found ${response.length} plans in direct array response`);
      return response;
    }
    
    // If the API returns an object with a plans property
    if (response.plans) {
      console.log(`Found ${response.plans.length} plans in response.plans`);
      return response.plans;
    }
    
    console.log('No plans found in response');
    return [];
  } catch (error) {
    console.error('Error fetching workspace plans:', error);
    return [];
  }
}

export function handlePlanMessage(data: Omit<Plan, 'workspaceId'> & { type: string, workspaceId: string }): void {
  // Handle incoming plan messages from WebSocket
  if (data.type === 'plan' && data.workspaceId) {
    // Process the plan
    console.log('Received plan message:', data);

    // Post to webview if available
    if (globalState?.webviewGlobal) {
      globalState.webviewGlobal.postMessage({
        command: 'newPlan',
        plan: data
      });
    }
  }
}