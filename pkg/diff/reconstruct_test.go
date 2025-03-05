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
			name:            "basic diff reconstruction",
			originalContent: "line1\nline2\nline3\n",
			diffContent: strings.TrimSpace(`--- file.txt
+++ file.txt
@@ -1 +1 @@
-line1
+newline1`) + "\n",
			want: strings.TrimSpace(`--- file.txt
+++ file.txt
@@ -1,1 +1,1 @@
-line1
+newline1`) + "\n",
			wantErr: false,
		},
		{
			name:            "multiple hunks",
			originalContent: "line1\nline2\nline3\nline4\n",
			diffContent: strings.TrimSpace(`--- file.txt
+++ file.txt
@@ -1 +1 @@
-line1
+newline1
@@ -4 +4 @@
-line4
+newline4`) + "\n",
			want: strings.TrimSpace(`--- file.txt
+++ file.txt
@@ -1,1 +1,1 @@
-line1
+newline1
@@ -4,1 +4,1 @@
-line4
+newline4`) + "\n",
			wantErr: false,
		},
		{
			name:            "invalid diff - no headers",
			originalContent: "line1\nline2\nline3\n",
			diffContent:     "@@ -1 +1 @@\n-line1\n+newline1\n",
			want:            "",
			wantErr:         true,
		},
		{
			name: "multi-line block removal",
			originalContent: `# Default values for empty-chart.
# This is a YAML-formatted file.
# Declare variables to be passed into your templates.

resources: {}
  # We usually recommend not to specify default resources and to leave this as a conscious
  # choice for the user. This also increases chances charts run on environments with little
  # resources, such as Minikube. If you do want to specify resources, uncomment the following
  # lines, adjust them as necessary, and remove the curly braces after 'resources:'.
  # limits:
  #   cpu: 100m
  #   memory: 128Mi
  # requests:
  #   cpu: 100m
  #   memory: 128Mi

# This is to setup the liveness and readiness probes
livenessProbe:
  httpGet:
    path: /
    port: http`,
			diffContent: strings.TrimSpace(`--- values.yaml
+++ values.yaml
@@ -103,18 +103,6 @@

   #    hosts:
   #      - chart-example.local

-resources: {}
-  # We usually recommend not to specify default resources and to leave this as a conscious
-  # choice for the user. This also increases chances charts run on environments with little
-  # resources, such as Minikube. If you do want to specify resources, uncomment the following
-  # lines, adjust them as necessary, and remove the curly braces after 'resources:'.
-  # limits:
-  #   cpu: 100m
-  #   memory: 128Mi
-  # requests:
-  #   cpu: 100m
-  #   memory: 128Mi
-
 # This is to setup the liveness and readiness probes`) + "\n",
			want: strings.TrimSpace(`--- values.yaml
+++ values.yaml
@@ -103,18 +103,6 @@

   #    hosts:
   #      - chart-example.local

-resources: {}
-  # We usually recommend not to specify default resources and to leave this as a conscious
-  # choice for the user. This also increases chances charts run on environments with little
-  # resources, such as Minikube. If you do want to specify resources, uncomment the following
-  # lines, adjust them as necessary, and remove the curly braces after 'resources:'.
-  # limits:
-  #   cpu: 100m
-  #   memory: 128Mi
-  # requests:
-  #   cpu: 100m
-  #   memory: 128Mi
-
 # This is to setup the liveness and readiness probes`) + "\n",
			wantErr: false,
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
			if !tt.wantErr && got != tt.want {
				t.Errorf("ReconstructDiff()\ngot:\n%q\nwant:\n%q", got, tt.want)
			}
		})
	}
}
