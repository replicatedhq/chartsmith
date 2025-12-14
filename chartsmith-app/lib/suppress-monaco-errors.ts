// Suppress Monaco Editor's harmless "TextModel got disposed" errors
if (typeof window !== 'undefined') {
  // Intercept console.error
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const firstArg = args[0];
    const errorMessage = typeof firstArg === 'string' ? firstArg : firstArg?.message || '';

    // Suppress Monaco disposal errors
    if (errorMessage.includes('TextModel got disposed') ||
        errorMessage.includes('DiffEditorWidget')) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Intercept console.warn as Monaco sometimes logs as warnings
  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    const firstArg = args[0];
    const errorMessage = typeof firstArg === 'string' ? firstArg : firstArg?.message || '';

    if (errorMessage.includes('TextModel got disposed') ||
        errorMessage.includes('DiffEditorWidget')) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  // Override window.onerror to catch uncaught errors
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const errorMessage = typeof message === 'string' ? message : error?.message || '';
    if (errorMessage.includes('TextModel got disposed') ||
        errorMessage.includes('DiffEditorWidget')) {
      return true; // Prevent default error handling
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Override unhandledrejection for promise-based errors
  const originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    const errorMessage = event.reason?.message || event.reason || '';
    if (typeof errorMessage === 'string' &&
        (errorMessage.includes('TextModel got disposed') ||
         errorMessage.includes('DiffEditorWidget'))) {
      event.preventDefault();
      return;
    }
    if (originalOnUnhandledRejection) {
      originalOnUnhandledRejection.call(window, event);
    }
  };
}

export {};
