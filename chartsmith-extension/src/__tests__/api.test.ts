import { fetchPendingFileContent } from '../modules/api';
import { AuthData } from '../types';

// Mock the fetchApi function that's used internally
jest.mock('../modules/api', () => {
  // Save the original module to use specific functions from it
  const originalModule = jest.requireActual('../modules/api');
  
  return {
    // Spread the original module to keep other functions
    ...originalModule,
    // Mock fetchApi which is used by fetchPendingFileContent
    fetchApi: jest.fn(),
    // Use the actual fetchPendingFileContent implementation
    fetchPendingFileContent: originalModule.fetchPendingFileContent,
  };
});

// Import the mocked fetchApi for our assertions
import { fetchApi } from '../modules/api';

describe('fetchPendingFileContent (deprecated - fallback method)', () => {
  // Add deprecation notice to test suite
  beforeAll(() => {
    console.warn(
      'WARNING: Tests for fetchPendingFileContent cover a deprecated API endpoint. ' +
      'This endpoint will be removed soon in favor of using the workspace endpoint.'
    );
  });
  
  // Mock auth data for testing
  const mockAuthData: AuthData = {
    token: 'test-token',
    apiEndpoint: 'https://api.chartsmith.test',
    userId: 'user-123',
    wwwEndpoint: 'https://chartsmith.test',
    pushEndpoint: 'https://push.chartsmith.test'
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should return content when API call succeeds', async () => {
    // Mock successful API response
    (fetchApi as jest.Mock).mockResolvedValue({ content: 'file content data' });
    
    const content = await fetchPendingFileContent(
      mockAuthData, 
      'workspace-123', 
      'plan-456', 
      'path/to/file.yaml'
    );
    
    // Verify the API was called with the correct parameters
    expect(fetchApi).toHaveBeenCalledWith(
      mockAuthData,
      '/workspace/workspace-123/plans/plan-456/file/path%2Fto%2Ffile.yaml',
      'GET'
    );
    
    // Verify the content was extracted correctly
    expect(content).toBe('file content data');
  });
  
  it('should return null when API call fails', async () => {
    // Mock failed API response
    (fetchApi as jest.Mock).mockRejectedValue(new Error('API error'));
    
    const content = await fetchPendingFileContent(
      mockAuthData, 
      'workspace-123', 
      'plan-456', 
      'path/to/file.yaml'
    );
    
    // Verify the API was called
    expect(fetchApi).toHaveBeenCalled();
    
    // Verify null is returned on error
    expect(content).toBeNull();
  });
  
  it('should return null when response has no content field', async () => {
    // Mock API response without content field
    (fetchApi as jest.Mock).mockResolvedValue({ 
      status: 'success',
      message: 'File found but no content available'
    });
    
    const content = await fetchPendingFileContent(
      mockAuthData, 
      'workspace-123', 
      'plan-456', 
      'path/to/file.yaml'
    );
    
    // Verify the API was called
    expect(fetchApi).toHaveBeenCalled();
    
    // Verify null is returned when content field is missing
    expect(content).toBeNull();
  });
  
  it('should return null when auth data is not provided', async () => {
    const content = await fetchPendingFileContent(
      null as any, 
      'workspace-123', 
      'plan-456', 
      'path/to/file.yaml'
    );
    
    // Verify the API was not called
    expect(fetchApi).not.toHaveBeenCalled();
    
    // Verify null is returned when auth data is missing
    expect(content).toBeNull();
  });
  
  it('should properly encode the file path in the URL', async () => {
    // Mock successful API response
    (fetchApi as jest.Mock).mockResolvedValue({ content: 'file content data' });
    
    // Use a file path with characters that need encoding
    const filePath = 'path/with spaces/and#special&chars.yaml';
    
    await fetchPendingFileContent(
      mockAuthData, 
      'workspace-123', 
      'plan-456', 
      filePath
    );
    
    // Verify the file path was properly encoded in the API call
    expect(fetchApi).toHaveBeenCalledWith(
      mockAuthData,
      `/workspace/workspace-123/plans/plan-456/file/${encodeURIComponent(filePath)}`,
      'GET'
    );
  });
}); 