import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { ReplicatedProvider } from './contexts/ReplicatedContext';
import { AuthProvider } from './contexts/AuthContext';
import { ValuesScenariosProvider } from './contexts/ValuesScenariosContext';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ReplicatedProvider>
          <ValuesScenariosProvider>
            <App />
          </ValuesScenariosProvider>
        </ReplicatedProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);