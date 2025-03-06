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
		expected        string
		wantErr         bool
	}{
		{
			name:            "basic single hunk diff",
			originalContent: "line1\nline2\nline3\n",
			diffContent: `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line1
+new line
 line2
 line3`,
			expected: `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line1
+new line
 line2
 line3
`,
			wantErr: false,
		},
		{
			name:            "Chart.yaml special case",
			originalContent: "name: mychart\nversion: 1.0.0\n",
			diffContent: `--- Chart.yaml
+++ Chart.yaml
@@ -1,2 +1,3 @@
 name: mychart
+description: A new chart
 version: 1.0.0`,
			expected: `--- Chart.yaml
+++ Chart.yaml
@@ -1,2 +1,3 @@
 name: mychart
+description: A new chart
 version: 1.0.0
`,
			wantErr: false,
		},
		{
			name:            "multiple hunks",
			originalContent: "1\n2\n3\n4\n5\n6\n7\n8\n",
			diffContent: `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 1
+1.5
 2
 3
@@ -6,3 +7,4 @@
 6
 7
 8
+9`,
			expected: `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 1
+1.5
 2
 3
@@ -6,3 +7,4 @@
 6
 7
 8
+9
`,
			wantErr: false,
		},
		{
			name:            "invalid diff content",
			originalContent: "test\n",
			diffContent:     "invalid",
			wantErr:         true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reconstructor := NewDiffReconstructor(tt.originalContent, tt.diffContent)
			got, err := reconstructor.ReconstructDiff()

			if tt.wantErr {
				if err == nil {
					t.Error("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			// Normalize line endings for comparison
			got = strings.ReplaceAll(got, "\r\n", "\n")
			expected := strings.ReplaceAll(tt.expected, "\r\n", "\n")

			if got != expected {
				t.Errorf("ReconstructDiff() got = %q, want %q", got, expected)
			}
		})
	}
}
