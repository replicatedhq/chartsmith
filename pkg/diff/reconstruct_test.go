package diff

import (
	"strings"
	"testing"
)

func TestReconstructDiff(t *testing.T) {
	tests := []struct {
		name            string
		originalContent string
		diffContent     string
		want            string
		wantErr         bool
	}{
		{
			name: "basic diff with correct line numbers",
			originalContent: `line1
line2
line3
line4`,
			diffContent: `--- a/file
+++ b/file
@@ -1,4 +1,5 @@
 line1
-line2
+newline2
+addedline
 line3
 line4`,
			want: `--- a/file
+++ b/file
@@ -1,4 +1,5 @@
 line1
-line2
+newline2
+addedline
 line3
 line4
`,
		},
		{
			name: "handles duplicate headers",
			originalContent: `apiVersion: v2
appVersion: 1.16.0
description: A Helm chart for Kubernetes
name: empty-chart
type: application
version: 0.1.0`,
			diffContent: `--- Chart.yaml
+++ Chart.yaml
--- Chart.yaml
+++ Chart.yaml
@@ -1,6 +1,18 @@
 apiVersion: v2
 appVersion: 1.16.0
-description: A Helm chart for Kubernetes
+description: A Helm chart for Kubernetes with optional Nginx Ingress Controller
 name: empty-chart
 type: application
 version: 0.1.0
+dependencies:
+  - name: ingress-nginx
+    version: "^4.0.0"
+    repository: https://kubernetes.github.io/ingress-nginx
+    condition: ingress-nginx.enabled
+    tags:
+      - ingress-controller
+      - nginx
+annotations:
+  artifacthub.io/changes: |
+    - Added Nginx Ingress Controller as an optional dependency
+    - Users can enable the dependency by setting ingress-nginx.enabled to true`,
			want: `--- Chart.yaml
+++ Chart.yaml
@@ -1,6 +1,18 @@
 apiVersion: v2
 appVersion: 1.16.0
-description: A Helm chart for Kubernetes
+description: A Helm chart for Kubernetes with optional Nginx Ingress Controller
 name: empty-chart
 type: application
 version: 0.1.0
+dependencies:
+  - name: ingress-nginx
+    version: "^4.0.0"
+    repository: https://kubernetes.github.io/ingress-nginx
+    condition: ingress-nginx.enabled
+    tags:
+      - ingress-controller
+      - nginx
+annotations:
+  artifacthub.io/changes: |
+    - Added Nginx Ingress Controller as an optional dependency
+    - Users can enable the dependency by setting ingress-nginx.enabled to true
`,
		},
		{
			name: "handles missing line numbers",
			originalContent: `line1
line2
line3`,
			diffContent: `--- a/file
+++ b/file
@@ -,3 +,4 @@
 line1
-line2
+newline2
 line3`,
			want: `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+newline2
 line3
`,
		},
		{
			name:            "handles multiple duplicate headers",
			originalContent: "line1\nline2\nline3\n",
			diffContent: `--- a/file
+++ b/file
--- a/file
+++ b/file
--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+newline2
 line3`,
			want: `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+newline2
 line3
`,
		},
		{
			name:            "handles incorrect file paths",
			originalContent: "line1\nline2\nline3\n",
			diffContent: `--- some/random/path.txt
+++ different/path.txt
@@ -1,3 +1,3 @@
 line1
-line2
+newline2
 line3`,
			want: `--- a/path.txt
+++ b/path.txt
@@ -1,3 +1,3 @@
 line1
-line2
+newline2
 line3
`,
		},
		{
			name:            "handles extra whitespace in patches",
			originalContent: "line1\nline2\nline3\n",
			diffContent: `---    a/file
+++     b/file
@@   -1,3   +1,3   @@
 line1
-  line2
+  newline2
 line3`,
			want: `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-  line2
+  newline2
 line3
`,
		},
		{
			name:            "combines adjacent hunks",
			originalContent: "line1\nline2\nline3\nline4\nline5\n",
			diffContent: `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+newline2
 line3
@@ -3,3 +3,3 @@
 line3
-line4
+newline4
 line5`,
			want: `--- a/file
+++ b/file
@@ -1,5 +1,5 @@
 line1
-line2
+newline2
 line3
-line4
+newline4
 line5
`,
		},
		{
			name:            "handles mixed line endings",
			originalContent: "line1\r\nline2\r\nline3\r\n",
			diffContent: `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+newline2
 line3`,
			want: `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+newline2
 line3
`,
		},
		{
			name:            "handles overlapping hunks",
			originalContent: "line1\nline2\nline3\nline4\n",
			diffContent: `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+newline2
 line3
@@ -2,3 +2,3 @@
 line2
-line3
+newline3
 line4`,
			want: `--- a/file
+++ b/file
@@ -1,4 +1,4 @@
 line1
-line2
-line3
+newline2
+newline3
 line4
`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := NewDiffReconstructor(tt.originalContent, tt.diffContent)
			got, err := d.ReconstructDiff()
			if (err != nil) != tt.wantErr {
				t.Errorf("ReconstructDiff() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("ReconstructDiff() diff\ngot:\n%v\nwant:\n%v", got, tt.want)
				// Print a more readable diff for debugging
				gotLines := strings.Split(got, "\n")
				wantLines := strings.Split(tt.want, "\n")
				for i := 0; i < len(gotLines) || i < len(wantLines); i++ {
					var gotLine, wantLine string
					if i < len(gotLines) {
						gotLine = gotLines[i]
					}
					if i < len(wantLines) {
						wantLine = wantLines[i]
					}
					if gotLine != wantLine {
						t.Errorf("line %d:\ngot:  %q\nwant: %q", i+1, gotLine, wantLine)
					}
				}
			}
		})
	}
}
