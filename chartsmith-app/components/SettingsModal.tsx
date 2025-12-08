"use client"

import React, { useState, useEffect } from 'react';
import { X, Trash2, Key, Check, Loader2, Lock, Shield } from 'lucide-react';
import { useTheme, Theme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserSettingAction } from '@/lib/auth/actions/update-user-setting';
import { useSession } from '@/app/hooks/useSession';
import { Session } from '@/lib/types/session';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
}

interface SettingsSection {
  id: 'general' | 'replicated' | 'appearance' | 'editor' | 'changes' | 'images';
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export function SettingsModal({ isOpen, onClose, session }: SettingsModalProps) {
  const { refreshSession } = useSession();
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<'general' | 'replicated' | 'appearance' | 'editor' | 'changes' | 'images'>('general');
  const [autoAcceptChanges, setAutoAcceptChanges] = useState(session.user?.settings?.automaticallyAcceptPatches ?? false);
  const [validateBeforeAccept, setValidateBeforeAccept] = useState(session.user?.settings?.evalBeforeAccept ?? false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [savingAutoAccept, setSavingAutoAccept] = useState(false);
  const [savingValidate, setSavingValidate] = useState(false);
  const [showMinimap, setShowMinimap] = useState(session.user?.settings?.showMinimap ?? false);
  const [tabSize, setTabSize] = useState(session.user?.settings?.tabSize ?? '2 spaces');
  const [localTheme, setLocalTheme] = useState(session.user?.settings?.theme ?? 'auto');
  const [savingMinimap, setSavingMinimap] = useState(false);
  const [savingTabSize, setSavingTabSize] = useState(false);
  const [isChangingTheme, setIsChangingTheme] = useState(false);
  const [publicEnv, setPublicEnv] = useState<Record<string, string>>({});
  const [useSecureBuildImages, setUseSecureBuildImages] = useState(session.user?.settings?.useSecureBuildImages ?? false);
  const [savingSecureBuildImages, setSavingSecureBuildImages] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("Failed to fetch config");
        const data = await res.json();
        setPublicEnv(data);
      } catch (err) {
        console.error("Failed to load public env config:", err);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    if (session.user?.settings) {
      setAutoAcceptChanges(session.user.settings.automaticallyAcceptPatches ?? false);
      setValidateBeforeAccept(session.user.settings.evalBeforeAccept ?? false);
      setShowMinimap(session.user.settings.showMinimap ?? false);
      setTabSize(session.user.settings.tabSize ?? '2 spaces');
      setUseSecureBuildImages(session.user.settings.useSecureBuildImages ?? false);

      // Only sync theme from database if there's a significant difference and we're not changing themes
      // Remove automatic sync to prevent hydration conflicts - let user manually change theme
      const dbTheme = session.user.settings.theme ?? 'auto';
      setLocalTheme(dbTheme);
    }
  }, [session.user?.settings]);

  // Sync localTheme only when modal opens (isOpen changes from false to true)
  useEffect(() => {
    if (isOpen && session.user?.settings) {
      const dbTheme = session.user.settings.theme ?? 'auto';
      console.log('Modal opened, syncing localTheme to:', dbTheme);
      setLocalTheme(dbTheme);
    }
  }, [isOpen, session.user?.settings?.theme]);

  // Debug localTheme changes
  useEffect(() => {
    console.log('localTheme state changed to:', localTheme);
  }, [localTheme]);

  if (!isOpen) return null;

  const handleDeleteChats = () => {
    setIsDeleting(true);
    setTimeout(() => {
      setIsDeleting(false);
    }, 1000);
  };

  const handleSaveToken = async () => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  };

  const handleReplicatedConnect = () => {
    if (!publicEnv.NEXT_PUBLIC_REPLICATED_REDIRECT_URI) {
      console.log(`Failed to get Replicated redirect URI`);
      return;
    }

    const redirectUri = publicEnv.NEXT_PUBLIC_REPLICATED_REDIRECT_URI;
    window.location.href = redirectUri;
  };

  const handleAutoAcceptChange = async (checked: boolean) => {
    if (!session.user) return;
    console.log('handleAutoAcceptChange called', { checked, currentValue: session.user.settings.automaticallyAcceptPatches });
    setSavingAutoAccept(true);
    try {
      setAutoAcceptChanges(checked);
      console.log('About to save automatically_accept_patches to database');
      const result = await updateUserSettingAction(session, 'automatically_accept_patches', checked.toString());
      console.log('Database save result:', result);
      // Update session locally to reflect the change immediately
      session.user.settings.automaticallyAcceptPatches = checked;
      console.log('Updated local session state:', session.user.settings.automaticallyAcceptPatches);
    } finally {
      setSavingAutoAccept(false);
    }
  };

  const handleValidateBeforeAcceptChange = async (checked: boolean) => {
    if (!session.user) return;
    console.log('handleValidateBeforeAcceptChange called', { checked, currentValue: session.user.settings.evalBeforeAccept });
    setSavingValidate(true);
    try {
      setValidateBeforeAccept(checked);
      console.log('About to save eval_before_accept to database');
      const result = await updateUserSettingAction(session, 'eval_before_accept', checked.toString());
      console.log('Database save result:', result);
      // Update session locally to reflect the change immediately
      session.user.settings.evalBeforeAccept = checked;
      console.log('Updated local session state:', session.user.settings.evalBeforeAccept);
    } finally {
      setSavingValidate(false);
    }
  };


  const handleThemeChange = async (newTheme: string) => {
    if (!session.user) return;
    console.log('handleThemeChange called', {
      newTheme,
      currentValue: session.user.settings.theme,
      currentLocalTheme: localTheme,
      currentContextTheme: theme
    });
    try {
      // Set flag to prevent automatic theme sync from interfering
      setIsChangingTheme(true);

      // Update local theme state immediately for UI responsiveness
      console.log('Setting localTheme to:', newTheme);
      setLocalTheme(newTheme);

      // Update theme context (this will also set the cookie)
      console.log('Setting theme context to:', newTheme);
      setTheme(newTheme as Theme);

      console.log('About to save theme to database');
      const result = await updateUserSettingAction(session, 'theme', newTheme);
      console.log('Database save result:', result);

      // Update session locally with the result from database
      if (result.theme) {
        session.user.settings.theme = result.theme;
        console.log('Updated local session state:', session.user.settings.theme);
      }

      console.log('After all updates:', {
        localTheme,
        contextTheme: theme,
        sessionTheme: session.user.settings.theme
      });
    } catch (error) {
      console.error('Failed to save theme:', error);
      // Revert both local theme and context theme on error
      setLocalTheme(session.user.settings.theme);
      setTheme(session.user.settings.theme as Theme);
    } finally {
      // Clear the flag after a short delay to allow state updates to settle
      setTimeout(() => setIsChangingTheme(false), 500);
    }
  };

  const handleTabSizeChange = async (newTabSize: string) => {
    if (!session.user) return;
    console.log('handleTabSizeChange called', { newTabSize, currentValue: session.user.settings.tabSize });
    setSavingTabSize(true);
    try {
      setTabSize(newTabSize);
      console.log('About to save tab_size to database');
      const result = await updateUserSettingAction(session, 'tab_size', newTabSize);
      console.log('Database save result:', result);
      // Update session locally to reflect the change immediately
      session.user.settings.tabSize = newTabSize;
      console.log('Updated local session state:', session.user.settings.tabSize);
    } finally {
      setSavingTabSize(false);
    }
  };

  const handleMinimapChange = async (checked: boolean) => {
    if (!session.user) return;
    console.log('handleMinimapChange called', { checked, currentValue: session.user.settings.showMinimap });
    setSavingMinimap(true);
    try {
      setShowMinimap(checked);
      console.log('About to save show_minimap to database');
      const result = await updateUserSettingAction(session, 'show_minimap', checked.toString());
      console.log('Database save result:', result);
      // Update session locally to reflect the change immediately
      session.user.settings.showMinimap = checked;
      console.log('Updated local session state:', session.user.settings.showMinimap);
    } finally {
      setSavingMinimap(false);
    }
  };

  const handleSecureBuildImagesChange = async (checked: boolean) => {
    if (!session.user) return;
    console.log('handleSecureBuildImagesChange called', { checked, currentValue: session.user.settings.useSecureBuildImages });
    setSavingSecureBuildImages(true);
    try {
      setUseSecureBuildImages(checked);
      console.log('About to save use_secure_build_images to database');
      const result = await updateUserSettingAction(session, 'use_secure_build_images', checked.toString());
      console.log('Database save result:', result);
      // Update session locally to reflect the change immediately
      session.user.settings.useSecureBuildImages = checked;
      console.log('Updated local session state:', session.user.settings.useSecureBuildImages);
    } finally {
      setSavingSecureBuildImages(false);
    }
  };

  const sections: SettingsSection[] = [
    {
      id: 'general',
      label: 'General',
      icon: <Trash2 className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <button
            onClick={handleDeleteChats}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 bg-error/10 hover:bg-error/20 text-error rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete All Chats'}</span>
          </button>
        </div>
      ),
    },
    {
      id: 'replicated',
      label: 'Replicated',
      icon: <Key className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-dark border-dark-border' : 'bg-gray-50 border-gray-200'} border`}>
            <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Link Replicated Account
            </h3>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Connect your Replicated account to access your application.
            </p>
            <button
              onClick={handleReplicatedConnect}
              className="w-full px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L10.59 5.41L16.17 11H4V13H16.17L10.59 18.59L12 20L20 12L12 4Z" fill="currentColor"/>
              </svg>
              Connect to Replicated
            </button>
          </div>

          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-dark border-dark-border' : 'bg-gray-50 border-gray-200'} border`}>
            <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Replicated API Token
            </h3>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Alternatively, you can manually enter your Replicated API token.
            </p>
            <div className="space-y-2">
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Paste your Replicated API token"
                className={`w-full px-3 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-dark border-dark-border text-gray-300 placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
              />
              <button
                onClick={handleSaveToken}
                disabled={!apiToken}
                className={`w-full px-4 py-2 rounded-lg text-white transition-colors ${
                  apiToken
                    ? 'bg-primary hover:bg-primary/90'
                    : 'bg-gray-500 cursor-not-allowed'
                }`}
              >
                Save Token
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 2V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 20V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4.93 4.93L6.34 6.34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M17.66 17.66L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.34 17.66L4.93 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19.07 4.93L17.66 6.34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>,
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme
            </label>
            <select
                value={localTheme}
                onChange={(e) => {
                  console.log('Select onChange triggered:', {
                    selectedValue: e.target.value,
                    currentLocalTheme: localTheme
                  });
                  handleThemeChange(e.target.value);
                }}
                className={`w-full px-3 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-dark border-dark-border text-gray-300'
                    : 'bg-white border-gray-300 text-gray-900'
                } border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
              >
                <option value="auto">Auto (System)</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
          </div>
        </div>
      ),
    },
    {
      id: 'editor',
      label: 'Editor',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16.5 3.5C16.8978 3.10217 17.4374 2.87868 18 2.87868C18.2786 2.87868 18.5544 2.93355 18.8118 3.04015C19.0692 3.14676 19.303 3.30301 19.5 3.5C19.697 3.69698 19.8532 3.93083 19.9598 4.18821C20.0665 4.44558 20.1213 4.72142 20.1213 5C20.1213 5.27857 20.0665 5.55441 19.9598 5.81179C19.8532 6.06916 19.697 6.30301 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>,
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tab Size
            </label>
            {savingTabSize ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-gray-500">Saving...</span>
              </div>
            ) : (
              <select
                value={tabSize}
                onChange={(e) => handleTabSizeChange(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-dark border-dark-border text-gray-300'
                    : 'bg-white border-gray-300 text-gray-900'
                } border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}>
                <option value="2 spaces">2 spaces</option>
                <option value="4 spaces">4 spaces</option>
                <option value="8 spaces">8 spaces</option>
              </select>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {savingMinimap ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <input
                type="checkbox"
                id="minimap"
                checked={showMinimap}
                onChange={(e) => handleMinimapChange(e.target.checked)}
                className={`rounded border transition-colors ${
                  theme === 'dark'
                    ? 'border-dark-border bg-dark text-primary'
                    : 'border-gray-300 bg-white text-primary'
                } focus:ring-primary`}
              />
            )}
            <label htmlFor="minimap" className={`text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Show Minimap
            </label>
          </div>
        </div>
      ),
    },
    {
      id: 'changes' as const,
      label: 'Changes',
      icon: <Check className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            {savingAutoAccept ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <input
                type="checkbox"
                id="auto-accept"
                checked={autoAcceptChanges}
                onChange={(e) => handleAutoAcceptChange(e.target.checked)}
                className={`rounded border transition-colors ${
                  theme === 'dark'
                    ? 'border-dark-border bg-dark text-primary'
                    : 'border-gray-300 bg-white text-primary'
                } focus:ring-primary`}
              />
            )}
            <label htmlFor="auto-accept" className={`text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Automatically accept all changes (YOLO)
            </label>
          </div>

          <div className="flex items-center space-x-2">
            {savingValidate ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <input
                type="checkbox"
                id="validate-before-accept"
                checked={validateBeforeAccept}
                disabled={autoAcceptChanges}
                onChange={(e) => handleValidateBeforeAcceptChange(e.target.checked)}
                className={`rounded border transition-colors ${
                  theme === 'dark'
                    ? 'border-dark-border bg-dark text-primary disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'border-gray-300 bg-white text-primary disabled:opacity-50 disabled:cursor-not-allowed'
                } focus:ring-primary`}
              />
            )}
            <label
              htmlFor="validate-before-accept"
              className={`text-sm ${
                theme === 'dark'
                  ? `text-gray-300 ${autoAcceptChanges ? 'opacity-50' : ''}`
                  : `text-gray-700 ${autoAcceptChanges ? 'opacity-50' : ''}`
              }`}
            >
              Run eval/validation before patches are accepted
            </label>
          </div>
        </div>
      ),
    },
    {
      id: 'images' as const,
      label: 'Images',
      icon: <Shield className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            {savingSecureBuildImages ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <input
                type="checkbox"
                id="secure-build-images"
                checked={useSecureBuildImages}
                onChange={(e) => handleSecureBuildImagesChange(e.target.checked)}
                className={`rounded border transition-colors ${
                  theme === 'dark'
                    ? 'border-dark-border bg-dark text-primary'
                    : 'border-gray-300 bg-white text-primary'
                } focus:ring-primary`}
              />
            )}
            <label htmlFor="secure-build-images" className={`text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Use SecureBuild images (cve0.io)
            </label>
          </div>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            When enabled, ChartSmith will prefer container images from the SecureBuild cve0.io registry, which provides vulnerability-free container images for enhanced security.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-3xl h-[600px] rounded-lg shadow-lg border flex ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`w-48 border-r p-2 ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                activeSection === section.id
                  ? 'bg-primary/10 text-primary'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-dark-border/40'
                    : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col">
          <div className={`flex items-center justify-between p-4 border-b ${
            theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
          }`}>
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {sections.find((s) => s.id === activeSection)?.label} Settings
            </h2>
            <button
              onClick={onClose}
              className={`${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-500 hover:text-gray-700'
              } transition-colors`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            {sections.find((s) => s.id === activeSection)?.content}
          </div>
        </div>
      </div>
    </div>
  );
}
