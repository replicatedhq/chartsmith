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
    
    let plans: Plan[] = [];
    
    // Handle different response structures
    if (Array.isArray(response)) {
      console.log(`Found ${response.length} plans in direct array response`);
      plans = response;
    }
    // If the API returns an object with a plans property
    else if (response && response.plans) {
      console.log(`Found ${response.plans.length} plans in response.plans`);
      plans = response.plans;
    }
    else {
      console.log('No plans found in response or unexpected response format');
    }
    
    // Log each plan ID for debugging
    if (plans.length > 0) {
      console.log('Plan IDs received:');
      plans.forEach(plan => {
        console.log(`- Plan ID: ${plan.id}, Status: ${plan.status}`);
        
        // Debug the structure of the actionFiles
        if (plan.actionFiles && plan.actionFiles.length > 0) {
          console.log('  Action Files:');
          plan.actionFiles.forEach(file => {
            console.log(`  - File: ${file.path}, Action: ${file.action}, Status: ${file.status}`);
            // Log all keys in the file object to see what's actually there
            console.log('    All properties:', Object.keys(file));
            // Check if there's a content_pending property
            if ('content_pending' in file) {
              console.log('    Has content_pending property');
            }
            // Check for contentPending
            if ('contentPending' in file) {
              console.log('    Has contentPending property');
            }
          });
        }
      });
    } else {
      console.log('No plans received from API');
    }
    
    return plans;
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