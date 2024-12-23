import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home,
  FolderKanban,
  Settings,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  ArrowLeft,
  FileJson
} from 'lucide-react';
import { UserMenu } from './UserMenu';
import { Tooltip } from '../common/Tooltip';
import { useTheme } from '../../contexts/ThemeContext';

interface SideNavProps {
  isChatVisible?: boolean;
  onToggleChat?: () => void;
  isFileTreeVisible?: boolean;
  onToggleFileTree?: () => void;
}

export function SideNav({ 
  isChatVisible = true, 
  onToggleChat,
  isFileTreeVisible = true,
  onToggleFileTree 
}: SideNavProps) {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isRecommendationsPage = location.pathname === '/recommendations';

  return (
    <nav className={`w-16 flex-shrink-0 ${theme === 'dark' ? 'bg-dark-surface border-dark-border' : 'bg-light-surface border-light-border'} border-r flex flex-col justify-between`}>
      <div className="py-4 flex flex-col items-center">
        <Tooltip content="Home">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                isActive 
                  ? 'text-primary' 
                  : `text-neutral hover:${theme === 'dark' ? 'bg-dark-border/40' : 'bg-light-border/40'}`
              }`
            }
          >
            <Home className="w-5 h-5" />
          </NavLink>
        </Tooltip>

        {isRecommendationsPage && (
          <div className="mt-4">
            <Tooltip content="Back to Chart">
              <NavLink
                to="/editor"
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors text-neutral hover:${theme === 'dark' ? 'bg-dark-border/40' : 'bg-light-border/40'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </NavLink>
            </Tooltip>
          </div>
        )}

        <div className="mt-8 w-full px-3">
          <div className={`border-t ${theme === 'dark' ? 'border-dark-border' : 'border-light-border'}`} />
        </div>

        <div className="mt-4">
          <Tooltip content="Toggle Chat">
            <button
              onClick={onToggleChat}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                isChatVisible 
                  ? `${theme === 'dark' ? 'bg-dark-border/60' : 'bg-light-border/60'} text-primary` 
                  : `text-neutral hover:${theme === 'dark' ? 'bg-dark-border/40' : 'bg-light-border/40'}`
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        <div className="mt-2">
          <Tooltip content="Toggle File Explorer">
            <button
              onClick={onToggleFileTree}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                isFileTreeVisible 
                  ? `${theme === 'dark' ? 'bg-dark-border/60' : 'bg-light-border/60'} text-primary` 
                  : `text-neutral hover:${theme === 'dark' ? 'bg-dark-border/40' : 'bg-light-border/40'}`
              }`}
            >
              <FolderKanban className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        <div className="mt-2">
          <Tooltip content="Values.yaml Scenarios">
            <NavLink
              to="/values-scenarios"
              className={({ isActive }) =>
                `w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                  isActive 
                    ? `${theme === 'dark' ? 'bg-dark-border/60' : 'bg-light-border/60'} text-primary` 
                    : `text-neutral hover:${theme === 'dark' ? 'bg-dark-border/40' : 'bg-light-border/40'}`
                }`
              }
            >
              <FileJson className="w-5 h-5" />
            </NavLink>
          </Tooltip>
        </div>

        <div className="mt-2">
          <Tooltip content="View Recommendations">
            <NavLink
              to="/recommendations"
              className={({ isActive }) =>
                `w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${
                  isActive 
                    ? `${theme === 'dark' ? 'bg-dark-border/60' : 'bg-light-border/60'} text-primary` 
                    : `text-neutral hover:${theme === 'dark' ? 'bg-dark-border/40' : 'bg-light-border/40'}`
                }`
              }
            >
              <Lightbulb className="w-5 h-5" />
              <div className="absolute -top-1 -right-1 bg-error text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                4
              </div>
            </NavLink>
          </Tooltip>
        </div>
      </div>

      <div className="py-4">
        <Tooltip content="Account Settings">
          <UserMenu />
        </Tooltip>
      </div>
    </nav>
  );
}