"use client";

/**
 * ConversationManager - UI for managing chat conversations
 * 
 * Provides:
 * - Save current conversation
 * - Load saved conversations
 * - Export as JSON or Markdown
 * - Delete conversations
 * - Clear current chat
 * 
 * @module components/ConversationManager
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { 
  Save, 
  FolderOpen, 
  Download, 
  Trash2, 
  MoreVertical, 
  FileJson, 
  FileText,
  X,
  Clock,
  MessageSquare,
  AlertTriangle,
  Upload,
  Edit2,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Message } from './types';
import { 
  useConversationStorage, 
  StoredConversation, 
  formatConversationDate 
} from '@/hooks/useConversationStorage';

interface ConversationManagerProps {
  /** Current messages in the chat */
  messages: Message[];
  /** Callback when a conversation is loaded */
  onLoadConversation: (messages: Message[]) => void;
  /** Callback to clear current chat */
  onClearChat: () => void;
  /** Current conversation ID if saved */
  currentConversationId?: string;
  /** Callback when conversation is saved */
  onConversationSaved?: (id: string) => void;
}

/**
 * Delete confirmation modal
 */
const DeleteConfirmModal = memo(function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  theme,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  theme: string;
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div 
        className={`w-full max-w-sm mx-4 p-4 rounded-lg shadow-xl ${
          theme === 'dark' ? 'bg-dark-surface border border-dark-border' : 'bg-white border border-gray-200'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
          </div>
          <div className="flex-1">
            <h3 
              id="delete-modal-title"
              className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              Delete Conversation
            </h3>
            <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Are you sure you want to delete "{title}"? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className={`px-3 py-1.5 text-xs rounded-md ${
              theme === 'dark'
                ? 'text-gray-300 hover:bg-dark-border/40'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 text-xs rounded-md ${
              theme === 'dark'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
});

/**
 * History panel showing saved conversations
 */
const HistoryPanel = memo(function HistoryPanel({
  isOpen,
  onClose,
  conversations,
  onLoad,
  onDelete,
  onRename,
  theme,
  currentId,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversations: StoredConversation[];
  onLoad: (conv: StoredConversation) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  theme: string;
  currentId?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleStartEdit = (conv: StoredConversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditTitle('');
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* Panel */}
      <div 
        className={`relative ml-auto w-full max-w-md h-full overflow-hidden shadow-2xl ${
          theme === 'dark' ? 'bg-dark-surface' : 'bg-white'
        }`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-panel-title"
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}>
          <h2 
            id="history-panel-title"
            className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            Conversation History
          </h2>
          <button
            onClick={onClose}
            aria-label="Close history panel"
            className={`p-1.5 rounded-md ${
              theme === 'dark' 
                ? 'text-gray-400 hover:text-white hover:bg-dark-border/40' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="overflow-y-auto h-[calc(100%-60px)]">
          {conversations.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full text-center p-8 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}>
              <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No saved conversations</p>
              <p className="text-xs mt-1">Save a conversation to see it here</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-dark-border">
              {conversations.map(conv => (
                <li 
                  key={conv.id}
                  className={`group relative ${
                    currentId === conv.id
                      ? theme === 'dark' ? 'bg-primary/10' : 'bg-primary/5'
                      : ''
                  }`}
                >
                  <button
                    onClick={() => onLoad(conv)}
                    className={`w-full text-left p-4 transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-dark-border/30'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {editingId === conv.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              ref={inputRef}
                              type="text"
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onKeyDown={handleKeyDown}
                              onBlur={handleSaveEdit}
                              className={`w-full px-2 py-1 text-sm rounded border ${
                                theme === 'dark'
                                  ? 'bg-dark border-dark-border text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                            />
                            <button
                              onClick={handleSaveEdit}
                              className={`p-1 rounded ${
                                theme === 'dark' ? 'hover:bg-dark-border' : 'hover:bg-gray-200'
                              }`}
                            >
                              <Check className="w-4 h-4 text-green-500" />
                            </button>
                          </div>
                        ) : (
                          <h3 className={`text-sm font-medium truncate ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {conv.title}
                          </h3>
                        )}
                        <p className={`text-xs mt-1 truncate ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {conv.preview}
                        </p>
                        <div className={`flex items-center gap-3 mt-2 text-xs ${
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatConversationDate(conv.updatedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {conv.messageCount} messages
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                        theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                      }`} />
                    </div>
                  </button>
                  
                  {/* Action buttons */}
                  <div className={`absolute right-12 top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                    theme === 'dark' ? 'bg-dark-surface' : 'bg-white'
                  }`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(conv);
                      }}
                      aria-label={`Rename ${conv.title}`}
                      className={`p-1.5 rounded ${
                        theme === 'dark'
                          ? 'text-gray-400 hover:text-white hover:bg-dark-border/60'
                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      aria-label={`Delete ${conv.title}`}
                      className={`p-1.5 rounded ${
                        theme === 'dark'
                          ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'
                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
});

/**
 * Main ConversationManager component
 */
export const ConversationManager = memo(function ConversationManager({
  messages,
  onLoadConversation,
  onClearChat,
  currentConversationId,
  onConversationSaved,
}: ConversationManagerProps) {
  const { theme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoredConversation | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    conversations,
    saveConversation,
    deleteConversation,
    renameConversation,
    exportAsJSON,
    exportAsMarkdown,
    importFromJSON,
  } = useConversationStorage();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setShowExportMenu(false);
        setIsHistoryOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSave = useCallback(() => {
    if (messages.length === 0) return;
    const id = saveConversation(messages, undefined, currentConversationId);
    onConversationSaved?.(id);
    setIsMenuOpen(false);
  }, [messages, saveConversation, currentConversationId, onConversationSaved]);

  const handleLoad = useCallback((conv: StoredConversation) => {
    onLoadConversation(conv.messages);
    onConversationSaved?.(conv.id);
    setIsHistoryOpen(false);
  }, [onLoadConversation, onConversationSaved]);

  const handleDelete = useCallback((id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setDeleteTarget(conv);
    }
  }, [conversations]);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteConversation(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteConversation]);

  const handleExportJSON = useCallback(() => {
    exportAsJSON(messages);
    setIsMenuOpen(false);
    setShowExportMenu(false);
  }, [messages, exportAsJSON]);

  const handleExportMarkdown = useCallback(() => {
    exportAsMarkdown(messages);
    setIsMenuOpen(false);
    setShowExportMenu(false);
  }, [messages, exportAsMarkdown]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
    setIsMenuOpen(false);
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const id = importFromJSON(content);
      if (id) {
        const conv = conversations.find(c => c.id === id);
        if (conv) {
          handleLoad(conv);
        }
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  }, [importFromJSON, conversations, handleLoad]);

  const handleClear = useCallback(() => {
    onClearChat();
    setIsMenuOpen(false);
  }, [onClearChat]);

  return (
    <>
      <div ref={menuRef} className="relative">
        {/* Menu trigger button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label="Conversation options"
          className={`p-1.5 rounded-md transition-colors ${
            theme === 'dark'
              ? 'text-gray-400 hover:text-white hover:bg-dark-border/40'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          } ${isMenuOpen ? theme === 'dark' ? 'bg-dark-border/40' : 'bg-gray-100' : ''}`}
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Dropdown menu */}
        {isMenuOpen && (
          <div
            role="menu"
            aria-label="Conversation options"
            className={`absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border py-1 z-50 ${
              theme === 'dark' ? 'bg-dark-surface border-dark-border' : 'bg-white border-gray-200'
            }`}
          >
            {/* Save */}
            <button
              role="menuitem"
              onClick={handleSave}
              disabled={messages.length === 0}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                messages.length === 0
                  ? theme === 'dark' ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-dark-border/40 hover:text-white'
                    : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Save className="w-4 h-4" />
              {currentConversationId ? 'Update Saved' : 'Save Conversation'}
            </button>

            {/* Load */}
            <button
              role="menuitem"
              onClick={() => {
                setIsHistoryOpen(true);
                setIsMenuOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                theme === 'dark'
                  ? 'text-gray-300 hover:bg-dark-border/40 hover:text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Load Conversation
              {conversations.length > 0 && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                  theme === 'dark' ? 'bg-dark-border text-gray-400' : 'bg-gray-100 text-gray-500'
                }`}>
                  {conversations.length}
                </span>
              )}
            </button>

            {/* Divider */}
            <div className={`my-1 border-t ${theme === 'dark' ? 'border-dark-border' : 'border-gray-200'}`} />

            {/* Export submenu */}
            <div className="relative">
              <button
                role="menuitem"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={messages.length === 0}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                  messages.length === 0
                    ? theme === 'dark' ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                    : theme === 'dark'
                      ? 'text-gray-300 hover:bg-dark-border/40 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Download className="w-4 h-4" />
                Export
                <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${showExportMenu ? 'rotate-90' : ''}`} />
              </button>

              {showExportMenu && messages.length > 0 && (
                <div className={`ml-2 mt-1 rounded-md border ${
                  theme === 'dark' ? 'bg-dark border-dark-border' : 'bg-gray-50 border-gray-200'
                }`}>
                  <button
                    role="menuitem"
                    onClick={handleExportJSON}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                      theme === 'dark'
                        ? 'text-gray-300 hover:bg-dark-border/40 hover:text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FileJson className="w-4 h-4" />
                    Export as JSON
                  </button>
                  <button
                    role="menuitem"
                    onClick={handleExportMarkdown}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                      theme === 'dark'
                        ? 'text-gray-300 hover:bg-dark-border/40 hover:text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Export as Markdown
                  </button>
                </div>
              )}
            </div>

            {/* Import */}
            <button
              role="menuitem"
              onClick={handleImport}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                theme === 'dark'
                  ? 'text-gray-300 hover:bg-dark-border/40 hover:text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Upload className="w-4 h-4" />
              Import from JSON
            </button>

            {/* Divider */}
            <div className={`my-1 border-t ${theme === 'dark' ? 'border-dark-border' : 'border-gray-200'}`} />

            {/* Clear */}
            <button
              role="menuitem"
              onClick={handleClear}
              disabled={messages.length === 0}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                messages.length === 0
                  ? theme === 'dark' ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                    : 'text-red-600 hover:bg-red-50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              Clear Chat
            </button>
          </div>
        )}

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* History panel */}
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        conversations={conversations}
        onLoad={handleLoad}
        onDelete={handleDelete}
        onRename={renameConversation}
        theme={theme}
        currentId={currentConversationId}
      />

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget?.title || ''}
        theme={theme}
      />
    </>
  );
});

