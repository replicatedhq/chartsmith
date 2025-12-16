/**
 * XML parser for streaming LLM responses.
 * Ported from pkg/llm/parser.go
 *
 * Handles parsing of chartsmithArtifactPlan and chartsmithArtifact tags
 * from streaming LLM output.
 */

import { HelmResponse, ActionPlan, Artifact } from './types';

export class Parser {
  private buffer: string = '';
  private result: HelmResponse = {
    title: '',
    actions: {},
    artifacts: [],
  };

  /**
   * Parse plan chunks from streaming input.
   * Extracts title from chartsmithArtifactPlan and action plans from chartsmithActionPlan tags.
   */
  parsePlan(chunk: string): void {
    this.buffer += chunk;

    // Extract title if we haven't already
    if (!this.result.title) {
      const titleRegex = /<chartsmithArtifactPlan[^>]*title="([^"]*)"[^>]*>/;
      const titleMatch = this.buffer.match(titleRegex);
      if (titleMatch && titleMatch[1]) {
        this.result.title = titleMatch[1];
      }
    }

    // Find all action plans
    const actionPlanRegex = /<chartsmithActionPlan\s+type="([^"]+)"\s+action="([^"]+)"\s+path="([^"]+)"[^>]*>/g;
    let match;

    while ((match = actionPlanRegex.exec(this.buffer)) !== null) {
      if (match.length !== 4) {
        continue;
      }

      const actionType = match[1]; // "file"
      const action = match[2];     // "create" or "update" or "delete"
      let path = match[3];         // file path

      // Strip any leading /
      path = path.replace(/^\//, '');

      // Check if we already have this file
      const artifactExists = this.result.artifacts.some(
        (artifact) => artifact.path === path
      );

      if (!artifactExists) {
        const actionPlan: ActionPlan = {
          type: actionType,
          action: action as 'create' | 'update' | 'delete',
        };

        this.result.actions[path] = actionPlan;
      }
    }
  }

  /**
   * Parse artifact chunks from streaming input.
   * Handles both complete and partial artifacts.
   */
  parseArtifacts(chunk: string): void {
    this.buffer += chunk;

    // Find complete artifacts first using matchAll to avoid regex state issues
    // Use negative lookahead (?!Plan) to avoid matching <chartsmithArtifactPlan>
    const completeRegex = /<chartsmithArtifact(?!Plan)([^>]*)>([\s\S]*?)<\/chartsmithArtifact>/g;
    const matches = [...this.buffer.matchAll(completeRegex)];

    for (const match of matches) {
      if (match.length !== 3) {
        continue;
      }

      const attributes = match[1];
      const content = match[2].trim();

      // Extract path from attributes
      const pathMatch = attributes.match(/path="([^"]*)"/);
      if (pathMatch && pathMatch[1]) {
        const path = pathMatch[1];
        this.addArtifact(content, path);
      }

      // Remove complete artifact from buffer
      this.buffer = this.buffer.replace(match[0], '');
    }

    // Check for partial artifacts (incomplete tags still being streamed)
    // Find <chartsmithArtifact but not <chartsmithArtifactPlan
    const partialRegex = /<chartsmithArtifact(?!Plan)/g;
    let partialMatch;
    let partialStart = -1;
    while ((partialMatch = partialRegex.exec(this.buffer)) !== null) {
      partialStart = partialMatch.index;
    }

    if (partialStart !== -1) {
      const partialContent = this.buffer.substring(partialStart);

      // Try to extract path from the opening tag
      const pathMatch = partialContent.match(/<chartsmithArtifact(?!Plan)[^>]*path="([^"]*)"/);
      if (pathMatch && pathMatch[1]) {
        const path = pathMatch[1];

        // Only process content if we found the closing angle bracket
        if (partialContent.includes('>')) {
          const contentStart = partialContent.indexOf('>') + 1;
          const content = partialContent.substring(contentStart).trim();
          if (content) {
            this.addArtifact(content, path);
          }
        }
      }
    }
  }

  /**
   * Add artifact with content and path.
   * Only appends if content is non-empty.
   */
  private addArtifact(content: string, path: string): void {
    const artifact: Artifact = {
      content,
      path,
    };

    // Only append if we have content
    if (artifact.content) {
      this.result.artifacts.push(artifact);
    }
  }

  /**
   * Get the current parse results.
   */
  getResult(): HelmResponse {
    return this.result;
  }

  /**
   * Reset the parser state.
   */
  reset(): void {
    this.buffer = '';
    this.result = {
      title: '',
      actions: {},
      artifacts: [],
    };
  }
}

/**
 * Create a new parser instance.
 */
export function createParser(): Parser {
  return new Parser();
}
