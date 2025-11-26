/**
 * useConversationStorage - Hook for managing conversation persistence
 * 
 * Provides functionality to:
 * - Save conversations to localStorage
 * - Load saved conversations
 * - List all saved conversations
 * - Delete conversations
 * - Export as JSON or Markdown
 * 
 * @module hooks/useConversationStorage
 */

import { useCallback, useState, useEffect } from 'react';
import { Message } from '@/components/types';

/**
 * Stored conversation structure
 */
export interface StoredConversation {
  /** Unique identifier */
  id: string;
  /** User-defined title or auto-generated */
  title: string;
  /** Array of messages in the conversation */
  messages: Message[];
  /** When the conversation was saved */
  createdAt: Date;
  /** When the conversation was last updated */
  updatedAt: Date;
  /** Number of messages */
  messageCount: number;
  /** Preview of first user message */
  preview: string;
}

/**
 * Serialized format for localStorage
 */
interface SerializedConversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

const STORAGE_KEY = 'chartsmith_conversations';
const MAX_CONVERSATIONS = 50; // Limit to prevent localStorage overflow

/**
 * Generate a preview from messages
 */
function generatePreview(messages: Message[]): string {
  const firstUserMessage = messages.find(m => m.prompt);
  if (firstUserMessage?.prompt) {
    const preview = firstUserMessage.prompt.substring(0, 100);
    return preview.length < firstUserMessage.prompt.length ? `${preview}...` : preview;
  }
  return 'Empty conversation';
}

/**
 * Generate a title from messages if not provided
 */
function generateTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(m => m.prompt);
  if (firstUserMessage?.prompt) {
    // Take first line or first 50 chars
    const firstLine = firstUserMessage.prompt.split('\n')[0];
    const title = firstLine.substring(0, 50);
    return title.length < firstLine.length ? `${title}...` : title;
  }
  return `Conversation ${new Date().toLocaleDateString()}`;
}

/**
 * Format date for display
 */
export function formatConversationDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Hook for conversation storage operations
 */
export function useConversationStorage() {
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load conversations from localStorage on mount
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: SerializedConversation[] = JSON.parse(stored);
        const hydrated: StoredConversation[] = parsed.map(c => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        }));
        // Sort by most recent first
        hydrated.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        setConversations(hydrated);
      }
    } catch (error) {
      console.error('[useConversationStorage] Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Persist conversations to localStorage
   */
  const persistConversations = useCallback((convs: StoredConversation[]) => {
    try {
      const serialized: SerializedConversation[] = convs.map(c => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.error('[useConversationStorage] Error saving conversations:', error);
      // Handle quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new Error('Storage quota exceeded. Please delete some conversations.');
      }
      throw error;
    }
  }, []);

  /**
   * Save a conversation
   */
  const saveConversation = useCallback((
    messages: Message[],
    title?: string,
    existingId?: string
  ): string => {
    const now = new Date();
    const id = existingId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const conversation: StoredConversation = {
      id,
      title: title || generateTitle(messages),
      messages,
      createdAt: existingId 
        ? conversations.find(c => c.id === existingId)?.createdAt || now 
        : now,
      updatedAt: now,
      messageCount: messages.length,
      preview: generatePreview(messages),
    };

    setConversations(prev => {
      let updated: StoredConversation[];
      
      if (existingId) {
        // Update existing
        updated = prev.map(c => c.id === existingId ? conversation : c);
      } else {
        // Add new, enforce limit
        updated = [conversation, ...prev];
        if (updated.length > MAX_CONVERSATIONS) {
          updated = updated.slice(0, MAX_CONVERSATIONS);
        }
      }
      
      // Sort by most recent
      updated.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      persistConversations(updated);
      return updated;
    });

    return id;
  }, [conversations, persistConversations]);

  /**
   * Load a conversation by ID
   */
  const loadConversation = useCallback((id: string): StoredConversation | null => {
    return conversations.find(c => c.id === id) || null;
  }, [conversations]);

  /**
   * List all conversations
   */
  const listConversations = useCallback((): StoredConversation[] => {
    return conversations;
  }, [conversations]);

  /**
   * Delete a conversation
   */
  const deleteConversation = useCallback((id: string): boolean => {
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id);
      persistConversations(updated);
      return updated;
    });
    return true;
  }, [persistConversations]);

  /**
   * Rename a conversation
   */
  const renameConversation = useCallback((id: string, newTitle: string): boolean => {
    setConversations(prev => {
      const updated = prev.map(c => 
        c.id === id 
          ? { ...c, title: newTitle, updatedAt: new Date() }
          : c
      );
      persistConversations(updated);
      return updated;
    });
    return true;
  }, [persistConversations]);

  /**
   * Export conversation as JSON
   */
  const exportAsJSON = useCallback((messages: Message[], title?: string): void => {
    const exportData = {
      title: title || generateTitle(messages),
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        prompt: m.prompt,
        response: m.response,
        createdAt: m.createdAt,
        isComplete: m.isComplete,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chartsmith-chat-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Export conversation as Markdown
   */
  const exportAsMarkdown = useCallback((messages: Message[], title?: string): void => {
    const conversationTitle = title || generateTitle(messages);
    const exportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let markdown = `# ${conversationTitle}\n\n`;
    markdown += `*Exported from ChartSmith on ${exportDate}*\n\n`;
    markdown += `---\n\n`;

    for (const message of messages) {
      if (message.prompt) {
        markdown += `## 👤 User\n\n`;
        markdown += `${message.prompt}\n\n`;
      }
      
      if (message.response) {
        markdown += `## 🤖 ChartSmith\n\n`;
        markdown += `${message.response}\n\n`;
      }
      
      markdown += `---\n\n`;
    }

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chartsmith-chat-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Clear all conversations
   */
  const clearAllConversations = useCallback((): void => {
    setConversations([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /**
   * Import conversation from JSON
   */
  const importFromJSON = useCallback((jsonString: string): string | null => {
    try {
      const data = JSON.parse(jsonString);
      
      if (!data.messages || !Array.isArray(data.messages)) {
        throw new Error('Invalid conversation format');
      }

      const messages: Message[] = data.messages.map((m: any, index: number) => ({
        id: m.id || `imported_${Date.now()}_${index}`,
        prompt: m.prompt || '',
        response: m.response || '',
        createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        isComplete: m.isComplete ?? true,
        isIntentComplete: true,
      }));

      return saveConversation(messages, data.title || 'Imported Conversation');
    } catch (error) {
      console.error('[useConversationStorage] Import error:', error);
      return null;
    }
  }, [saveConversation]);

  return {
    // State
    conversations,
    isLoading,
    
    // Operations
    saveConversation,
    loadConversation,
    listConversations,
    deleteConversation,
    renameConversation,
    clearAllConversations,
    
    // Export/Import
    exportAsJSON,
    exportAsMarkdown,
    importFromJSON,
  };
}

