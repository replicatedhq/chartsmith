declare module 'parse-git-patch' {
  export interface Hunk {
    content: string;
    newStart: number;
    newLines: number;
    oldStart: number;
    oldLines: number;
  }

  export interface ParsedPatch {
    hunks: Hunk[];
    oldFile: string;
    newFile: string;
  }

  export function parsePatch(patch: string): ParsedPatch[];
}

declare module 'patch' {
  export function applyPatch(content: string, hunks: import('parse-git-patch').Hunk[]): string;
}

declare module 'unified-diff' {
  export function applyPatch(content: string[], patch: string): string[] | null;
}

declare module 'patch-package/dist/applyPatch' {
  interface PatchOptions {
    allowFail?: boolean;
    strip?: number;
  }

  interface PatchResult {
    success: boolean;
    contents: string;
    hunks?: {
      accepted: number;
      total: number;
    };
  }

  export function applyPatch(
    originalContent: string,
    patchContent: string,
    options?: PatchOptions
  ): PatchResult;
}
