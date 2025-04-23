import * as vscode from 'vscode';
import {
  API_ENDPOINT_KEY,
  PUSH_ENDPOINT_KEY,
  WWW_ENDPOINT_KEY
} from '../../constants';
import { log } from '../logging';

/**
 * Check if development mode is enabled
 * Development mode enables additional features like demo content generation
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
  const endpoint = config.get<string>('apiEndpoint') || 'https://chartsmith.ai';
  log.debug(`Read apiEndpoint from settings: ${endpoint}`);
  return endpoint;
}

/**
 * Get the WWW endpoint from configuration with fallback to default
 */
export function getWwwEndpointConfig(): string {
  const config = vscode.workspace.getConfiguration('chartsmith');
  const endpoint = config.get<string>('wwwEndpoint') || 'https://chartsmith.ai';
  log.debug(`Read wwwEndpoint from settings: ${endpoint}`);
  return endpoint;
}

/**
 * Get the push endpoint from configuration (optional)
 */
export function getPushEndpointConfig(): string {
  const config = vscode.workspace.getConfiguration('chartsmith');
  const endpoint = config.get<string>('pushEndpoint') || '';
  log.debug(`Read pushEndpoint from settings: ${endpoint || '(not set)'}`);
  return endpoint;
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

  // Check if WWW endpoint is already set in secret storage
  const wwwEndpoint = await secretStorage.get(WWW_ENDPOINT_KEY);
  log.debug(`Current wwwEndpoint in storage: ${wwwEndpoint || '(not set)'}`);
  
  if (!wwwEndpoint) {
    // Set default from configuration or hardcoded fallback
    const configEndpoint = getWwwEndpointConfig();
    log.debug(`Setting default wwwEndpoint in storage: ${configEndpoint}`);
    await secretStorage.store(WWW_ENDPOINT_KEY, configEndpoint);
  }

  // Check if push endpoint is already set in secret storage
  const pushEndpoint = await secretStorage.get(PUSH_ENDPOINT_KEY);
  log.debug(`Current pushEndpoint in storage: ${pushEndpoint || '(not set)'}`);
  
  if (!pushEndpoint) {
    // Set default from configuration or hardcoded fallback
    const configValue = getPushEndpointConfig();
    if (configValue) {
      log.debug(`Setting default pushEndpoint in storage: ${configValue}`);
      await secretStorage.store(PUSH_ENDPOINT_KEY, configValue);
    }
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
  const wwwEndpointConfig = getWwwEndpointConfig();
  const pushEndpointConfig = getPushEndpointConfig();
  
  // Show current stored values for comparison
  const currentApiEndpoint = await secretStorage.get(API_ENDPOINT_KEY);
  const currentWwwEndpoint = await secretStorage.get(WWW_ENDPOINT_KEY);
  const currentPushEndpoint = await secretStorage.get(PUSH_ENDPOINT_KEY);
  
  log.debug(`Current stored values: ${JSON.stringify({
    apiEndpoint: currentApiEndpoint || '(not set)',
    wwwEndpoint: currentWwwEndpoint || '(not set)',
    pushEndpoint: currentPushEndpoint || '(not set)'
  })}`);
  
  log.debug(`New values from configuration: ${JSON.stringify({
    apiEndpoint: apiEndpointConfig,
    wwwEndpoint: wwwEndpointConfig,
    pushEndpoint: pushEndpointConfig || '(not set)'
  })}`);
  
  // Update with new configuration values
  await secretStorage.store(API_ENDPOINT_KEY, apiEndpointConfig);
  await secretStorage.store(WWW_ENDPOINT_KEY, wwwEndpointConfig);
  
  if (pushEndpointConfig) {
    await secretStorage.store(PUSH_ENDPOINT_KEY, pushEndpointConfig);
  } else {
    // If no push endpoint is configured, clear it from storage
    await secretStorage.delete(PUSH_ENDPOINT_KEY);
  }
  
  log.debug(`Endpoints have been reset to match configuration`);
} 