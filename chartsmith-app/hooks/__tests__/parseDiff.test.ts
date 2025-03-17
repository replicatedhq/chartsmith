import { parseDiff } from '../useMonacoSingleInstance';
import { applyDiffByContent } from './directDiffApplier';

describe('parseDiff', () => {
  // Test case for the specific line removal issue
  test('correctly identifies and removes the right line by content', () => {
    const original = `  version: 4.12.0
- alias: okteto-nginx
  condition: okteto-nginx.enabled
  name: ingress-nginx
  repository: https://kubernetes.github.io/ingress-nginx
  version: 4.12.0
- condition: reloader.enabled`;

    const diff = `--- Chart.yaml
+++ Chart.yaml
@@ -10,7 +10,6 @@
   version: 4.12.0
 - alias: okteto-nginx
   condition: okteto-nginx.enabled
-  name: ingress-nginx
   repository: https://kubernetes.github.io/ingress-nginx
   version: 4.12.0
 - condition: reloader.enabled`;

    // Use our direct implementation
    const result = applyDiffByContent(original, diff);
    
    // Check that the line "name: ingress-nginx" is actually removed
    expect(result).not.toContain("name: ingress-nginx");
    
    // Check that we didn't accidentally remove any other lines
    expect(result).toContain("condition: okteto-nginx.enabled");
    expect(result).toContain("repository: https://kubernetes.github.io/ingress-nginx");
  });

  // Test case for context before addition issue
  test('correctly adds a line after the context line', () => {
    const original = `annotations:
- email: irespaldiza@okteto.com
name: okteto`;

    const diff = `--- Chart.yaml
+++ Chart.yaml
@@ -37,1 +37,2 @@
 - email: irespaldiza@okteto.com
+# Controls how logging behaves`;

    // Use our direct implementation
    const result = applyDiffByContent(original, diff);
    
    // Check that the new line is added after the context line
    const lines = result.split('\n');
    const emailLineIndex = lines.findIndex(line => line.trim() === '- email: irespaldiza@okteto.com');
    expect(emailLineIndex).toBeGreaterThanOrEqual(0);
    
    const nextLine = lines[emailLineIndex + 1];
    
    // Next line should be the added comment, not "name: okteto"
    expect(nextLine.trim()).toBe('# Controls how logging behaves');
  });
  
  // Test a more complex case with multiple changes
  test('works with a mix of additions and removals', () => {
    const original = `dependencies:
- name: ingress-nginx
  repository: https://kubernetes.github.io/ingress-nginx
  version: 4.12.0
- alias: okteto-nginx
  condition: okteto-nginx.enabled
  name: ingress-nginx
  repository: https://kubernetes.github.io/ingress-nginx
  version: 4.12.0`;

    const diff = `--- Chart.yaml
+++ Chart.yaml
@@ -1,9 +1,10 @@
 dependencies:
 - name: ingress-nginx
+  newField: some-value
   repository: https://kubernetes.github.io/ingress-nginx
   version: 4.12.0
 - alias: okteto-nginx
   condition: okteto-nginx.enabled
-  name: ingress-nginx
   repository: https://kubernetes.github.io/ingress-nginx
-  version: 4.12.0
+  version: 5.0.0
+  anotherField: some-other-value`;

    // Use our direct implementation
    const result = applyDiffByContent(original, diff);
    
    // Line should be removed
    expect(result).not.toContain("  name: ingress-nginx");
    
    // New lines should be added
    expect(result).toContain("  newField: some-value");
    expect(result).toContain("  version: 5.0.0");
    expect(result).toContain("  anotherField: some-other-value");
  });
  
  // Test case for multi-line additions in the correct order
  test('preserves the order of multi-line additions', () => {
    const original = `annotations:
  artifacthub.io/changes: |
    - The changelog is available at https://www.okteto.com/docs/release-notes
apiVersion: v2
appVersion: 3fd2e76e9
dependencies:
- name: ingress-nginx
  repository: https://kubernetes.github.io/ingress-nginx
  version: 4.12.0
- condition: reloader.enabled
  name: reloader
  repository: https://stakater.github.io/stakater-charts`;

    const diff = `--- Chart.yaml
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

    // Use our implementation
    const result = parseDiff(original, diff);
    
    // Check the second addition (4 lines)
    const lines = result.split('\n');
    
    // Find where the traefik dependency starts
    const conditionIndex = lines.findIndex(line => 
      line.trim() === '- condition: traefik.enabled');
    expect(conditionIndex).toBeGreaterThan(0);
    
    // Verify lines are in the correct order
    expect(lines[conditionIndex].trim()).toBe('- condition: traefik.enabled');
    expect(lines[conditionIndex + 1].trim()).toBe('name: traefik');
    expect(lines[conditionIndex + 2].trim()).toBe('repository: https://traefik.github.io/charts');
    expect(lines[conditionIndex + 3].trim()).toBe('version: 23.1.0');
    
    // Also verify the first addition was done correctly
    const changelogAdditionIndex = lines.findIndex(line => 
      line.includes('Added Traefik as an ingress controller option'));
    expect(changelogAdditionIndex).toBeGreaterThan(0);
  });
});