package diff

import (
	"testing"
)

func TestApplyPatch(t *testing.T) {
	tests := []struct {
		name        string
		content     string
		patch       string
		expected    string
		expectError bool
	}{
		{
			name:        "simple addition",
			content:     "line1\nline2\nline3\n",
			patch:       "--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,4 @@\n line1\n+new line\n line2\n line3",
			expected:    "line1\nnew line\nline2\nline3\n",
			expectError: false,
		},
		{
			name:        "simple deletion",
			content:     "line1\nline2\nline3\n",
			patch:       "--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,2 @@\n line1\n-line2\n line3",
			expected:    "line1\nline3\n",
			expectError: false,
		},
		{
			name:        "replacement",
			content:     "line1\nline2\nline3\n",
			patch:       "--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,3 @@\n line1\n-line2\n+replaced line\n line3",
			expected:    "line1\nreplaced line\nline3\n",
			expectError: false,
		},
		{
			name:        "multiple hunks",
			content:     "1\n2\n3\n4\n5\n6\n7\n8\n",
			patch:       "--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,4 @@\n 1\n+1.5\n 2\n 3\n@@ -6,3 +7,4 @@\n 6\n 7\n 8\n+9",
			expected:    "1\n1.5\n2\n3\n4\n5\n6\n7\n8\n9\n",
			expectError: false,
		},
		{
			name:        "empty patch",
			content:     "test content\n",
			patch:       "",
			expected:    "test content\n",
			expectError: false,
		},
		{
			name:        "invalid patch",
			content:     "test content\n",
			patch:       "not a valid patch",
			expected:    "test content\n",
			expectError: true,
		},
		{
			name:        "yaml indentation changes",
			content:     "securityContext:\n  runAsNonRoot: true\ncontainers:\n  - name: ssh-agent\n    image: {{ include \"okteto.image.backend\" . }}\n    imagePullPolicy: {{ .Values.pullPolicy }}\n    ports:",
			patch:       "--- a/deployment.yaml\n+++ b/deployment.yaml\n@@ -1,7 +1,7 @@\n securityContext:\n   runAsNonRoot: true\n containers:\n-  - name: ssh-agent\n+  - name: sshd-agent\n     image: {{ include \"okteto.image.backend\" . }}\n     imagePullPolicy: {{ .Values.pullPolicy }}\n     ports:",
			expected:    "securityContext:\n  runAsNonRoot: true\ncontainers:\n  - name: sshd-agent\n    image: {{ include \"okteto.image.backend\" . }}\n    imagePullPolicy: {{ .Values.pullPolicy }}\n    ports:",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ApplyPatch(tt.content, tt.patch)
			
			// Check error expectation
			if tt.expectError && err == nil {
				t.Error("expected an error but got none")
				return
			}
			if !tt.expectError && err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			
			// Skip comparison if we expected an error
			if tt.expectError {
				return
			}

			// Compare result with expected
			if result != tt.expected {
				t.Errorf("expected:\n%s\nbut got:\n%s", tt.expected, result)
			}
		})
	}
}

func TestApplyPatches(t *testing.T) {
	tests := []struct {
		name        string
		content     string
		patches     []string
		expected    string
		expectError bool
	}{
		{
			name:    "multiple sequential patches",
			content: "line1\nline2\nline3\n",
			patches: []string{
				"--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,4 @@\n line1\n+new line\n line2\n line3",
				"--- a/file.txt\n+++ b/file.txt\n@@ -1,4 +1,5 @@\n line1\n new line\n+another line\n line2\n line3",
			},
			expected:    "line1\nnew line\nanother line\nline2\nline3\n",
			expectError: false,
		},
		{
			name:    "patch with deletion then addition",
			content: "line1\nline2\nline3\n",
			patches: []string{
				"--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,2 @@\n line1\n-line2\n line3",
				"--- a/file.txt\n+++ b/file.txt\n@@ -1,2 +1,3 @@\n line1\n+new line\n line3",
			},
			expected:    "line1\nnew line\nline3\n",
			expectError: false,
		},
		{
			name:    "empty patches",
			content: "test content\n",
			patches: []string{"", "   ", "\n"},
			expected:    "test content\n",
			expectError: false,
		},
		{
			name:    "invalid second patch",
			content: "line1\nline2\nline3\n",
			patches: []string{
				"--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,4 @@\n line1\n+new line\n line2\n line3",
				"not a valid patch",
			},
			expected:    "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ApplyPatches(tt.content, tt.patches)
			
			// Check error expectation
			if tt.expectError && err == nil {
				t.Error("expected an error but got none")
				return
			}
			if !tt.expectError && err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			
			// Skip comparison if we expected an error
			if tt.expectError {
				return
			}

			// Compare result with expected
			if result != tt.expected {
				t.Errorf("expected:\n%s\nbut got:\n%s", tt.expected, result)
			}
		})
	}
}