import { createStore } from 'jotai';
import { messagesAtom, workspaceIdAtom, connectionStatusAtom, rendersAtom } from './atoms';

// Create a store that will persist data
export const store = createStore();

// Track store changes for debugging
store.sub(rendersAtom, () => {
  console.log('Renders atom changed:', store.get(rendersAtom));
});

// Initialize the store with default values
store.set(messagesAtom, []);
store.set(rendersAtom, []);
store.set(workspaceIdAtom, null);
store.set(connectionStatusAtom, 'disconnected');

// Actions to update state
export const actions = {
  setWorkspaceId: (id: string | null) => {
    store.set(workspaceIdAtom, id);
    if (id === null) {
      // Clear messages and renders when workspace is cleared
      store.set(messagesAtom, []);
      store.set(rendersAtom, []);
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
  
  setConnectionStatus: (status: string) => {
    store.set(connectionStatusAtom, status);
  }
};

// Make the store global for debugging
(window as any).jotaiStore = {
  get: (atomName: string) => {
    switch (atomName) {
      case 'messages':
        return store.get(messagesAtom);
      case 'renders':
        return store.get(rendersAtom);
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
      case 'setRenders':
        actions.setRenders(payload);
        break;
      case 'addRender':
        actions.addRender(payload);
        break;
      case 'setConnectionStatus':
        actions.setConnectionStatus(payload);
        break;
    }
  }
};