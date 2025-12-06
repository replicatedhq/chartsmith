/**
 * PR3.0: K8s to Helm Conversion Client
 *
 * Provides TypeScript client for the Go /api/conversion/start endpoint.
 * Used to trigger the K8s to Helm conversion pipeline from the AI SDK path.
 */

import { callGoEndpoint } from "./tools/utils";

/**
 * Represents a K8s manifest file to convert
 */
interface ConversionFile {
  filePath: string;
  fileContent: string;
}

interface StartConversionRequest {
  workspaceId: string;
  chatMessageId: string;
  sourceFiles: ConversionFile[];
}

interface StartConversionResponse {
  conversionId: string;
}

/**
 * Starts a K8s to Helm conversion via Go backend
 *
 * This triggers the existing Go conversion pipeline which:
 * 1. Analyzes K8s manifests
 * 2. Sorts files by dependency order
 * 3. Converts each file to Helm templates
 * 4. Normalizes values.yaml
 * 5. Simplifies and cleans up
 *
 * Progress is published via Centrifugo events which the frontend
 * displays in ConversionProgress.tsx
 *
 * @param authHeader - Authorization header to forward to Go backend
 * @param workspaceId - The current workspace ID
 * @param chatMessageId - The chat message ID to associate with the conversion
 * @param sourceFiles - Array of K8s manifest files to convert
 * @returns The created conversion ID
 */
export async function startConversion(
  authHeader: string | undefined,
  workspaceId: string,
  chatMessageId: string,
  sourceFiles: ConversionFile[]
): Promise<string> {
  const response = await callGoEndpoint<StartConversionResponse>(
    "/api/conversion/start",
    {
      workspaceId,
      chatMessageId,
      sourceFiles,
    } as StartConversionRequest,
    authHeader
  );

  return response.conversionId;
}

