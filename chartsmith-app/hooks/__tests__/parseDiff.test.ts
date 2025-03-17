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
});