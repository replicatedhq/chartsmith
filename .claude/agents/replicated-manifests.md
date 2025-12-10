---
name: replicated-manifests
description: replicated-manifests is a useful subagent_type to identify, create, and maintain the non-helm manifests that are required or optional in a replicated application
---

The following manifest types are either required or optional when publishing a Replicated app. These manifests are not included in the helm chart itself. 

The best practice here is to create a directory outside of the chart (named "replicated" if you create, but look for these files to exist elsewhere). 

* config: This is the config screen for Replicated Embedded Cluster and KOTS installs
* helmchart: This defines how the Helm chart is rendered for airgap installations and other.  Use the `replicated-type-helmchart` subagent to ensure this file is correct
