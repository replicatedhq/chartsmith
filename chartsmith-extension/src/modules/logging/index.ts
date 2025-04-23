import * as vscode from 'vscode';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Logger class for ChartSmith
 */
class Logger {
  private outputChannel: vscode.OutputChannel;
  private debugMode: boolean = false;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('ChartSmith');
    
    // Initialize debug mode based on development mode setting
    this.updateDebugModeFromSettings();
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('chartsmith.developmentMode')) {
        this.updateDebugModeFromSettings();
      }
    });
  }
  
  /**
   * Update debug mode based on development mode setting
   */
  private updateDebugModeFromSettings(): void {
    const config = vscode.workspace.getConfiguration('chartsmith');
    const devMode = config.get<boolean>('developmentMode') || false;
    
    if (devMode) {
      this.debugMode = true;
      this.debug('Debug mode enabled (based on chartsmith.developmentMode setting)');
    } else {
      this.debug('Debug mode will be disabled (based on chartsmith.developmentMode setting)');
      this.debugMode = false;
    }
  }

  /**
   * Enable debug mode
   */
  public enableDebug(): void {
    this.debugMode = true;
    this.debug('Debug mode enabled');
  }

  /**
   * Disable debug mode
   */
  public disableDebug(): void {
    this.debug('Debug mode disabled');
    this.debugMode = false;
  }

  /**
   * Log a debug message
   * @param message The message to log
   */
  public debug(message: string): void {
    if (this.debugMode) {
      this.log(LogLevel.DEBUG, message);
    }
  }

  /**
   * Log an info message
   * @param message The message to log
   */
  public info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  /**
   * Log a warning message
   * @param message The message to log
   */
  public warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  /**
   * Log an error message
   * @param message The message to log
   */
  public error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  /**
   * Log a message with the specified level
   * @param level The log level
   * @param message The message to log
   */
  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    this.outputChannel.appendLine(formattedMessage);
    
    // Only output debug messages to console when in development mode
    if (level === LogLevel.DEBUG && !this.debugMode) {
      return;
    }
    
    // Also output to console during development
    if (process.env.NODE_ENV === 'development' || this.debugMode) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    }
  }

  /**
   * Show the output channel
   */
  public show(): void {
    this.outputChannel.show();
  }
  
  /**
   * Check if debug mode is enabled
   */
  public isDebugEnabled(): boolean {
    return this.debugMode;
  }
}

// Create a singleton instance
export const log = new Logger(); 