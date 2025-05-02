export const AUTH_TOKEN_KEY = 'chartsmith.authToken';

// Primary endpoint key - this is the only one that should be used going forward
export const API_ENDPOINT_KEY = 'chartsmith.apiEndpoint';

// Legacy endpoint keys - these will be removed in a future version
// They are kept here for backward compatibility only
// @deprecated - Use API_ENDPOINT_KEY and derive other endpoints from it
export const PUSH_ENDPOINT_KEY = 'chartsmith.pushEndpoint'; 
// @deprecated - Use API_ENDPOINT_KEY and derive other endpoints from it
export const WWW_ENDPOINT_KEY = 'chartsmith.wwwEndpoint';

export const USER_ID_KEY = 'chartsmith.userId';
export const WORKSPACE_MAPPINGS_KEY = 'chartsmith.workspaceMappings';
// API_BASE_URL removed as it's inconsistent with the dynamic endpoint approach