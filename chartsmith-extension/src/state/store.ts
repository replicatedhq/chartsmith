import { createStore } from 'jotai';
import { messagesAtom, workspaceIdAtom, connectionStatusAtom, rendersAtom, plansAtom, activePlanAtom, Plan } from './atoms';

// Create a store that will persist data
export const store = createStore();

// Track store changes for debugging
store.sub(rendersAtom, () => {
  console.log('Renders atom changed:', store.get(rendersAtom));
});

// Track message changes
store.sub(messagesAtom, () => {
  console.log('Messages atom changed:', store.get(messagesAtom));
});

// Track plans changes
store.sub(plansAtom, () => {
  console.log('Plans atom changed:', store.get(plansAtom));
});

// Track plans that have been explicitly marked as approved/applied to prevent overrides
const approvedPlansCache = new Map<string, { status: string, timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

// Initialize the store with default values
store.set(messagesAtom, []);
store.set(rendersAtom, []);
store.set(plansAtom, []);
store.set(workspaceIdAtom, null);
store.set(connectionStatusAtom, 'disconnected');
store.set(activePlanAtom, null);

// Extend the store type with our custom methods
interface ExtendedStore {
  getState(): {
    messages: any[];
    renders: any[];
    plans: Plan[];
    workspaceId: string | null;
    connectionStatus: string;
    activePlan: Plan | null;
  };
}

// Add getState method to the store
(store as any).getState = function() {
  return {
    messages: store.get(messagesAtom),
    renders: store.get(rendersAtom),
    plans: store.get(plansAtom),
    workspaceId: store.get(workspaceIdAtom),
    connectionStatus: store.get(connectionStatusAtom),
    activePlan: store.get(activePlanAtom)
  };
};

// Actions to update state
export const actions = {
  setWorkspaceId: (id: string | null) => {
    store.set(workspaceIdAtom, id);
    if (id === null) {
      // Clear messages, renders, and plans when workspace is cleared
      store.set(messagesAtom, []);
      store.set(rendersAtom, []);
      store.set(plansAtom, []);
    }
  },
  
  setMessages: (messages: any[]) => {
    store.set(messagesAtom, messages);
  },
  
  addMessage: (message: any) => {
    const currentMessages = store.get(messagesAtom);
    // Only add if message doesn't already exist (check by id)
    if (!currentMessages.some(m => m.id === message.id)) {
      store.set(messagesAtom, [...currentMessages, message]);
    }
  },
  
  updateMessage: (message: any) => {
    console.log('========= UPDATE MESSAGE ACTION CALLED ==========');
    console.log('Message to update:', message);
    
    // Check for responsePlanId in the message for debugging
    if (message.responsePlanId) {
      console.log(`Message ${message.id} has responsePlanId: ${message.responsePlanId}`);
    }
    
    const currentMessages = store.get(messagesAtom);
    console.log('Current messages:', currentMessages);
    
    const existingMessageIndex = currentMessages.findIndex(m => m.id === message.id);
    console.log('Existing message index:', existingMessageIndex);
    
    // If the message exists, update it
    if (existingMessageIndex !== -1) {
      console.log('Updating existing message');
      const updatedMessages = [...currentMessages];
      const oldMessage = updatedMessages[existingMessageIndex];
      console.log('Old message:', oldMessage);
      
      // Preserve responsePlanId when present
      const updatedMessage = {
        ...oldMessage,
        ...message
      };
      
      updatedMessages[existingMessageIndex] = updatedMessage;
      
      console.log('Updated message:', updatedMessages[existingMessageIndex]);
      if (updatedMessage.responsePlanId) {
        console.log(`Updated message has responsePlanId: ${updatedMessage.responsePlanId}`);
      }
      
      console.log('Setting new messages array');
      store.set(messagesAtom, updatedMessages);
    } else {
      // If not, add it as a new message
      console.log('Adding as new message');
      store.set(messagesAtom, [...currentMessages, message]);
    }
    
    // Verify the update
    const messagesAfterUpdate = store.get(messagesAtom);
    console.log('Messages after update:', messagesAfterUpdate);
  },
  
  setRenders: (renders: any[]) => {
    store.set(rendersAtom, renders);
  },
  
  addRender: (render: any) => {
    const currentRenders = store.get(rendersAtom);
    // Only add if render doesn't already exist (check by id)
    if (!currentRenders.some(r => r.id === render.id)) {
      store.set(rendersAtom, [...currentRenders, render]);
    }
  },
  
  setPlans: (plans: Plan[]) => {
    // Clean up expired cache entries
    const now = Date.now();
    approvedPlansCache.forEach((entry, id) => {
      if (now - entry.timestamp > CACHE_TTL) {
        approvedPlansCache.delete(id);
      }
    });
    
    // Apply cached statuses
    const updatedPlans = plans.map(plan => {
      // First ensure all plans have explicit boolean flags
      let updatedPlan = { 
        ...plan,
        approved: plan.approved === true ? true : false,
        applied: plan.applied === true ? true : false
      };
      
      // Set flags based on status for consistency
      if (updatedPlan.status === 'approved' || updatedPlan.status === 'applied') {
        updatedPlan.approved = true;
      }
      if (updatedPlan.status === 'applied') {
        updatedPlan.applied = true;
      }
      
      // Now check if we have a cached status override
      const cachedStatus = approvedPlansCache.get(plan.id);
      if (cachedStatus) {
        // If this plan is in our cache, prioritize the cached status
        console.log(`Using cached status for plan ${plan.id}: ${cachedStatus.status}`);
        
        // Update properties based on cached status
        if (cachedStatus.status === 'approved' || cachedStatus.status === 'applied') {
          updatedPlan.approved = true;
        }
        if (cachedStatus.status === 'applied') {
          updatedPlan.applied = true;
        }
        
        // Only override the status if our cached status is "more advanced"
        // e.g., don't replace "applied" with "approved"
        if (cachedStatus.status === 'applied' || 
            (cachedStatus.status === 'approved' && plan.status !== 'applied')) {
          updatedPlan.status = cachedStatus.status;
        }
      }
      
      // Log any plans that are explicitly excluded from showing the proceed button
      if (updatedPlan.approved || updatedPlan.applied || 
          updatedPlan.status === 'approved' || updatedPlan.status === 'applied') {
        console.log(`Plan ${updatedPlan.id} will not show proceed button: 
          - approved: ${updatedPlan.approved}
          - applied: ${updatedPlan.applied}
          - status: ${updatedPlan.status}`);
      }
      
      return updatedPlan;
    });
    
    store.set(plansAtom, updatedPlans);
  },
  
  addPlan: (plan: Plan) => {
    // Check if we have a cached status for this plan
    const cachedStatus = approvedPlansCache.get(plan.id);
    let planToAdd = plan;
    
    if (cachedStatus) {
      // Apply cached status
      console.log(`Using cached status for plan ${plan.id}: ${cachedStatus.status}`);
      planToAdd = { ...plan };
      
      if (cachedStatus.status === 'approved' || cachedStatus.status === 'applied') {
        planToAdd.approved = true;
      }
      if (cachedStatus.status === 'applied') {
        planToAdd.applied = true;
      }
      
      // Only override the status if our cached status is "more advanced"
      if (cachedStatus.status === 'applied' || 
          (cachedStatus.status === 'approved' && plan.status !== 'applied')) {
        planToAdd.status = cachedStatus.status;
      }
    } else {
      // For new plans without cached status, explicitly set approved/applied flags
      // This is important to ensure they're not undefined
      planToAdd = { 
        ...plan,
        approved: plan.approved === true ? true : false,
        applied: plan.applied === true ? true : false
      };

      // Set flags based on status for consistency
      if (planToAdd.status === 'approved' || planToAdd.status === 'applied') {
        planToAdd.approved = true;
      }
      if (planToAdd.status === 'applied') {
        planToAdd.applied = true;
      }

      console.log(`Initialized plan ${planToAdd.id} with explicit flags:
        - approved: ${planToAdd.approved}
        - applied: ${planToAdd.applied}
        - status: ${planToAdd.status}`);
    }
    
    const currentPlans = store.get(plansAtom);
    const existingPlanIndex = currentPlans.findIndex(p => p.id === planToAdd.id);
    
    if (existingPlanIndex !== -1) {
      // If plan exists, update it
      console.log(`Updating existing plan in store: ${planToAdd.id}`);
      const updatedPlans = [...currentPlans];
      updatedPlans[existingPlanIndex] = {
        ...updatedPlans[existingPlanIndex],
        ...planToAdd
      };
      store.set(plansAtom, updatedPlans);
    } else {
      // If plan doesn't exist, add it
      console.log(`Adding new plan to store: ${planToAdd.id}`);
      store.set(plansAtom, [...currentPlans, planToAdd]);
    }
  },
  
  updatePlanStatus: (planId: string, status: string) => {
    const currentPlans = store.get(plansAtom);
    const existingPlanIndex = currentPlans.findIndex(p => p.id === planId);
    
    if (existingPlanIndex !== -1) {
      // If plan exists, update its status
      console.log(`Updating plan status: ${planId} -> ${status}`);
      const updatedPlans = [...currentPlans];
      updatedPlans[existingPlanIndex] = {
        ...updatedPlans[existingPlanIndex],
        status: status
      };
      
      // Set additional properties based on status
      if (status === 'approved' || status === 'applied') {
        updatedPlans[existingPlanIndex].approved = true;
        
        // Add to cache to prevent overrides
        approvedPlansCache.set(planId, {
          status: status,
          timestamp: Date.now()
        });
      }
      if (status === 'applied') {
        updatedPlans[existingPlanIndex].applied = true;
      }
      
      store.set(plansAtom, updatedPlans);
    }
  },
  
  setConnectionStatus: (status: string) => {
    store.set(connectionStatusAtom, status);
  },
  
  // Action to update file status in a plan
  updateFileStatus: (planId: string, filePath: string, status: string) => {
    const currentPlans = store.get(plansAtom);
    const existingPlanIndex = currentPlans.findIndex(p => p.id === planId);
    
    if (existingPlanIndex !== -1) {
      // If plan exists, find and update the file status
      const plan = currentPlans[existingPlanIndex];
      if (plan.actionFiles && Array.isArray(plan.actionFiles)) {
        const fileIndex = plan.actionFiles.findIndex(file => file.path === filePath);
        
        if (fileIndex !== -1) {
          console.log(`Updating file status for ${filePath} in plan ${planId}: ${status}`);
          
          // Create a new plan with updated file status
          const updatedPlan = { ...plan };
          const updatedFiles = [...updatedPlan.actionFiles];
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            status: status
          };
          updatedPlan.actionFiles = updatedFiles;
          
          // Update the plan in the store
          const updatedPlans = [...currentPlans];
          updatedPlans[existingPlanIndex] = updatedPlan;
          store.set(plansAtom, updatedPlans);
          
          // Check if all files are applied/updated/created
          const allComplete = updatedFiles.every(file => 
            file.status === 'applied' || 
            file.status === 'updated' || 
            file.status === 'created'
          );
          
          // If all files are complete, also update the plan status
          if (allComplete) {
            actions.updatePlanStatus(planId, 'applied');
          }
        }
      }
    }
  }
};

// Make the store global for debugging (only in browser context)
// This ensures we don't try to access window in Node.js contexts
if (typeof window !== 'undefined') {
  (window as any).jotaiStore = {
    get: (atomName: string) => {
      switch (atomName) {
        case 'messages':
          return store.get(messagesAtom);
        case 'renders':
          return store.get(rendersAtom);
        case 'plans':
          return store.get(plansAtom);
        case 'workspaceId':
          return store.get(workspaceIdAtom);
        case 'connectionStatus':
          return store.get(connectionStatusAtom);
        default:
          return null;
      }
    },
    set: (actionName: string, payload: any) => {
      switch (actionName) {
        case 'setWorkspaceId':
          actions.setWorkspaceId(payload);
          break;
        case 'setMessages':
          actions.setMessages(payload);
          break;
        case 'addMessage':
          actions.addMessage(payload);
          break;
        case 'updateMessage':
          actions.updateMessage(payload);
          break;
        case 'setRenders':
          actions.setRenders(payload);
          break;
        case 'addRender':
          actions.addRender(payload);
          break;
        case 'setPlans':
          actions.setPlans(payload);
          break;
        case 'addPlan':
          actions.addPlan(payload);
          break;
        case 'updatePlanStatus':
          actions.updatePlanStatus(payload.planId, payload.status);
          break;
        case 'setConnectionStatus':
          actions.setConnectionStatus(payload);
          break;
        case 'updateFileStatus':
          actions.updateFileStatus(payload.planId, payload.filePath, payload.status);
          break;
      }
    }
  };
}