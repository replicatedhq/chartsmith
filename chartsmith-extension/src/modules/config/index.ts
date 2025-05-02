import * as vscode from 'vscode';
import {
  API_ENDPOINT_KEY
} from '../../constants';
import { log } from '../logging';
import { deriveWwwEndpoint, derivePushEndpoint } from '../endpoints';

/**
 * Check if development mode is enabled
 * Development mode enables additional features for debugging
 */
export function isDevelopmentMode(): boolean {
  const config = vscode.workspace.getConfiguration('chartsmith');
  const devMode = config.get<boolean>('developmentMode') || false;
  log.debug(`Development mode is ${devMode ? 'enabled' : 'disabled'}`);
  return devMode;
}

/**
 * Get the API endpoint from configuration with fallback to default
 */
export function getApiEndpointConfig(): string {
  const config = vscode.workspace.getConfiguration('chartsmith');
  const endpoint = config.get<string>('apiEndpoint') || 'https://chartsmith.ai/api';
  log.debug(`Read apiEndpoint from settings: ${endpoint}`);
  return endpoint;
}

/**
 * Get the WWW endpoint derived from the API endpoint
 */
export function getWwwEndpointConfig(): string {
  // Derive from API endpoint
  const apiEndpoint = getApiEndpointConfig();
  const wwwEndpoint = deriveWwwEndpoint(apiEndpoint);
  log.debug(`Derived wwwEndpoint from apiEndpoint: ${wwwEndpoint}`);
  return wwwEndpoint;
}

/**
 * Get the push endpoint derived from the API endpoint
 */
export function getPushEndpointConfig(): string {
  // Derive from API endpoint
  const apiEndpoint = getApiEndpointConfig();
  const pushEndpoint = derivePushEndpoint(apiEndpoint);
  log.debug(`Derived pushEndpoint from apiEndpoint: ${pushEndpoint}`);
  return pushEndpoint;
}

/**
 * Initialize default configuration values when not already set
 * This ensures first-time users don't need to configure anything for production use
 */
export async function initDefaultConfigIfNeeded(secretStorage: vscode.SecretStorage): Promise<void> {
  log.debug(`Initializing default configuration if needed`);
  
  // Check if API endpoint is already set in secret storage
  const apiEndpoint = await secretStorage.get(API_ENDPOINT_KEY);
  log.debug(`Current apiEndpoint in storage: ${apiEndpoint || '(not set)'}`);
  
  if (!apiEndpoint) {
    // Set default from configuration or hardcoded fallback
    const configEndpoint = getApiEndpointConfig();
    log.debug(`Setting default apiEndpoint in storage: ${configEndpoint}`);
    await secretStorage.store(API_ENDPOINT_KEY, configEndpoint);
  }
  
  log.debug(`Configuration initialization complete`);
}

/**
 * Force reset of stored endpoints to match current configuration
 * This is helpful when the stored endpoints don't match the actual development environment
 */
export async function resetEndpointsToConfig(secretStorage: vscode.SecretStorage): Promise<void> {
  log.debug(`Force resetting endpoints to match current configuration...`);
  
  // Get current configuration values
  const apiEndpointConfig = getApiEndpointConfig();
  
  // Show current stored values for comparison
  const currentApiEndpoint = await secretStorage.get(API_ENDPOINT_KEY);
  
  log.debug(`Current stored API endpoint: ${currentApiEndpoint || '(not set)'}`);
  log.debug(`New API endpoint: ${apiEndpointConfig}`);
  
  // Update with new configuration values
  await secretStorage.store(API_ENDPOINT_KEY, apiEndpointConfig);
  
  log.debug(`Endpoints have been reset to match configuration`);
} 