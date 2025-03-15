/**
 * @jest-environment node
 */

import { RenderedWorkspace } from "@/lib/types/workspace";

// Export the deduplication function from WorkspaceContent for testing
function deduplicateRendersByRevision(renders: RenderedWorkspace[]): RenderedWorkspace[] {
  // Group renders by revision number
  const rendersByRevision = new Map<number, RenderedWorkspace[]>();
  
  // First, group all renders by their revision number
  renders.forEach(render => {
    if (!rendersByRevision.has(render.revisionNumber)) {
      rendersByRevision.set(render.revisionNumber, []);
    }
    rendersByRevision.get(render.revisionNumber)!.push(render);
  });
  
  // For each revision, keep only the most recently created render
  const deduplicatedRenders: RenderedWorkspace[] = [];
  rendersByRevision.forEach(rendersForRevision => {
    // Sort by createdAt (newest first)
    rendersForRevision.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Keep only the first (most recent) render for each revision
    deduplicatedRenders.push(rendersForRevision[0]);
  });
  
  return deduplicatedRenders;
}

describe("WorkspaceContent deduplication functions", () => {
  describe("deduplicateRendersByRevision", () => {
    it("should deduplicate renders with the same revision number", () => {
      // Create sample chart for testing
      const sampleChart = {
        id: "chart-id",
        chartId: "chart-id",
        chartName: "Sample Chart",
        isSuccess: true,
        createdAt: new Date(),
        renderedFiles: []
      };

      // Create sample renders with duplicate revision numbers
      const renders: RenderedWorkspace[] = [
        {
          id: "render-1",
          workspaceId: "workspace-1",
          revisionNumber: 1,
          createdAt: new Date("2023-01-01"),
          charts: [sampleChart]
        },
        {
          id: "render-2",
          workspaceId: "workspace-1",
          revisionNumber: 1, // Same revision number
          createdAt: new Date("2023-01-02"), // Newer
          charts: [sampleChart]
        },
        {
          id: "render-3",
          workspaceId: "workspace-1",
          revisionNumber: 2, // Different revision
          createdAt: new Date("2023-01-03"),
          charts: [sampleChart]
        }
      ];

      // Deduplicate the renders
      const dedupedRenders = deduplicateRendersByRevision(renders);

      // Should have 2 renders (one for each unique revision)
      expect(dedupedRenders.length).toBe(2);
      
      // Should keep the newest render for revision 1
      expect(dedupedRenders.some(r => r.id === "render-2")).toBe(true);
      expect(dedupedRenders.some(r => r.id === "render-1")).toBe(false);
      
      // Should keep the render for revision 2
      expect(dedupedRenders.some(r => r.id === "render-3")).toBe(true);
    });

    it("should handle empty input", () => {
      const result = deduplicateRendersByRevision([]);
      expect(result).toEqual([]);
    });

    it("should handle input with no duplicates", () => {
      const sampleChart = {
        id: "chart-id",
        chartId: "chart-id",
        chartName: "Sample Chart",
        isSuccess: true,
        createdAt: new Date(),
        renderedFiles: []
      };

      const renders: RenderedWorkspace[] = [
        {
          id: "render-1",
          workspaceId: "workspace-1",
          revisionNumber: 1,
          createdAt: new Date("2023-01-01"),
          charts: [sampleChart]
        },
        {
          id: "render-2",
          workspaceId: "workspace-1",
          revisionNumber: 2,
          createdAt: new Date("2023-01-02"),
          charts: [sampleChart]
        }
      ];

      const result = deduplicateRendersByRevision(renders);
      expect(result.length).toBe(2);
      expect(result).toEqual(renders);
    });
  });
});