import { AuthData } from '../../types';
import { fetchApi } from '../api';

export async function fetchWorkspaceRenders(
  authData: AuthData,
  workspaceId: string
): Promise<any[]> {
  try {
    const response = await fetchApi(
      authData,
      `v1/workspaces/${workspaceId}/renders`,
      'GET'
    );
    
    return response.renders || [];
  } catch (error) {
    console.error('Error fetching workspace renders:', error);
    return [];
  }
}

export async function requestWorkspaceRender(
  authData: AuthData,
  workspaceId: string,
  params: any = {}
): Promise<any> {
  try {
    return await fetchApi(
      authData,
      `v1/workspaces/${workspaceId}/renders`,
      'POST',
      params
    );
  } catch (error) {
    console.error('Error requesting workspace render:', error);
    throw error;
  }
}

export async function getRenderDetails(
  authData: AuthData,
  workspaceId: string,
  renderId: string
): Promise<any> {
  try {
    return await fetchApi(
      authData,
      `v1/workspaces/${workspaceId}/renders/${renderId}`,
      'GET'
    );
  } catch (error) {
    console.error('Error fetching render details:', error);
    throw error;
  }
}