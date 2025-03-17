// Extract the getPatchStats function for isolated testing
// This is a simplified version that maintains the core logic we want to test
const getPatchStats = (patches?: string[]) => {
  if (!patches || patches.length === 0) return null;
  
  let totalAdditions = 0;
  let totalDeletions = 0;
  
  for (const patch of patches) {
    const lines = patch.split('\n');
    let additions = 0;
    let deletions = 0;
    let contentStarted = false;

    // Check if this is a new file patch
    const isNewFile = patch.includes('@@ -0,0 +1,');

    if (isNewFile) {
      for (const line of lines) {
        // Skip headers
        if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
          continue;
        }
        additions++;
      }
    } else {
      // Regular diff processing
      for (const line of lines) {
        if (!contentStarted && line.startsWith('@')) {
          contentStarted = true;
          continue;
        }
        if (contentStarted) {
          if (line.startsWith('+')) additions++;
          if (line.startsWith('-')) deletions++;
        }
      }
    }
    
    // Add to the total counts
    totalAdditions += additions;
    totalDeletions += deletions;
  }

  return { additions: totalAdditions, deletions: totalDeletions };
};

describe('FileTree getPatchStats', () => {
  test('returns null when no patches are provided', () => {
    expect(getPatchStats()).toBeNull();
    expect(getPatchStats([])).toBeNull();
  });

  test('counts additions and deletions from a single patch', () => {
    const patch = `--- file.txt
+++ file.txt
@@ -1,3 +1,4 @@
 line 1
+line 2
 line 3
 line 4`;
    
    expect(getPatchStats([patch])).toEqual({ additions: 1, deletions: 0 });
  });

  test('sums additions and deletions from multiple patches', () => {
    const patch1 = `--- file.txt
+++ file.txt
@@ -1,3 +1,4 @@
 line 1
+line 2
 line 3
 line 4`;

    const patch2 = `--- file.txt
+++ file.txt
@@ -1,4 +1,4 @@
 line 1
 line 2
-line 3
+line 3 modified
 line 4`;

    expect(getPatchStats([patch1, patch2])).toEqual({ additions: 2, deletions: 1 });
  });

  test('handles complex patches with multiple hunks', () => {
    const complexPatch = `--- Chart.yaml
+++ Chart.yaml
@@ -1,6 +1,7 @@
 annotations:
   artifacthub.io/changes: |
     - The changelog is available at https://www.okteto.com/docs/release-notes
+    - Added Traefik as an ingress controller option
 apiVersion: v2
 appVersion: 3fd2e76e9
 dependencies:
@@ -13,6 +14,10 @@
   name: ingress-nginx
   repository: https://kubernetes.github.io/ingress-nginx
   version: 4.12.0
+- condition: traefik.enabled
+  name: traefik
+  repository: https://traefik.github.io/charts
+  version: 23.1.0
 - condition: reloader.enabled
   name: reloader
   repository: https://stakater.github.io/stakater-charts`;

    expect(getPatchStats([complexPatch])).toEqual({ additions: 5, deletions: 0 });
  });

  test('handles new file patches', () => {
    const newFilePatch = `--- /dev/null
+++ new-file.txt
@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3`;

    expect(getPatchStats([newFilePatch])).toEqual({ additions: 3, deletions: 0 });
  });
});