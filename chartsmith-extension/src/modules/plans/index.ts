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
    
    // FIRST NORMALIZATION PASS: Ensure all plans have explicit boolean flags
    plans = plans.map(plan => {
      // Create a normalized plan object with explicit boolean flags
      const normalizedPlan = {
        ...plan,
        // Force approved and applied to be explicit booleans
        approved: Boolean(plan.approved) === true,
        applied: Boolean(plan.applied) === true
      };
      
      // Set flags based on status for consistency
      if (normalizedPlan.status === 'approved' || normalizedPlan.status === 'applied') {
        normalizedPlan.approved = true;
      }
      if (normalizedPlan.status === 'applied') {
        normalizedPlan.applied = true;
      }
      
      console.log(`[PLANS] Normalized plan ${plan.id}:
        - Before: approved=${plan.approved}, applied=${plan.applied}, status=${plan.status}
        - After: approved=${normalizedPlan.approved}, applied=${normalizedPlan.applied}, status=${normalizedPlan.status}`);
      
      return normalizedPlan;
    });
    
    // Check for any manually marked approved/applied plans in the store
    // and preserve that state
    try {
      const storeModule = await import('../../state/store');
      if (storeModule && storeModule.store) {
        const plansAtom = (await import('../../state/atoms')).plansAtom;
        const currentPlans = storeModule.store.get(plansAtom);
        
        // For each plan, check if it already exists in the store 
        // and preserve its approved/applied status
        plans = plans.map(newPlan => {
          const existingPlan = currentPlans.find(plan => plan.id === newPlan.id);
          if (existingPlan) {
            // Create a merged plan with preserved flags
            const mergedPlan = {
              ...newPlan,
              approved: existingPlan.approved || newPlan.approved || (newPlan.status === 'approved' || newPlan.status === 'applied'),
              applied: existingPlan.applied || newPlan.applied || (newPlan.status === 'applied')
            };
            
            console.log(`[PLANS] Merged with existing plan ${newPlan.id}:
              - From store: approved=${existingPlan.approved}, applied=${existingPlan.applied}
              - From API: approved=${newPlan.approved}, applied=${newPlan.applied}, status=${newPlan.status}
              - Result: approved=${mergedPlan.approved}, applied=${mergedPlan.applied}`);
            
            return mergedPlan;
          }
          return newPlan;
        });
      }
    } catch (error) {
      console.error('Error preserving plan status from store:', error);
    }
    
    // Log each plan ID for debugging
    if (plans.length > 0) {
      console.log('Plan IDs received:');
      plans.forEach(plan => {
        console.log(`- Plan ID: ${plan.id}, Status: ${plan.status}, Approved: ${plan.approved}, Applied: ${plan.applied}`);
        console.log(`  The type of approved flag is: ${typeof plan.approved}`);
        console.log(`  The type of applied flag is: ${typeof plan.applied}`);
        
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
    console.log('Received plan message from WebSocket:', data);

    // Ensure plan flags are explicitly set before adding to store
    const processedPlan: Plan = {
      ...data,
      approved: data.approved === true ? true : false,
      applied: data.applied === true ? true : false,
      // Set flags based on status for consistency
      ...(data.status === 'approved' || data.status === 'applied' ? { approved: true } : {}),
      ...(data.status === 'applied' ? { applied: true } : {}),
    };

    // Add plan to store if available
    import('../../state/store').then(({ actions }) => {
      console.log('Adding plan to store via WebSocket message:', processedPlan);
      actions.addPlan(processedPlan);
    }).catch(err => {
      console.error('Error importing store for WebSocket plan:', err);
    });

    // Post to webview if available
    if (globalState?.webviewGlobal) {
      globalState.webviewGlobal.postMessage({
        command: 'newPlan',
        plan: processedPlan
      });
    }
  }
}