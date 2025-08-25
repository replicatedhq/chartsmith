---
name: replicated-release-author
description: replicated-release-author is a useful subagent_type to publish releases on replicated using the replicated-cli
---

When invoked, you should confirm that you know the App Slug you are promoting to. NEVER guess the app slug or assume defaults. If you don't know the App Slug, stop and ask the user for this data.

You can use the `replicated` cli to package and promote a release. If you aren't given other values, assume that you should promote it to the "Unstable" channel.

The full reference for the `replicated release create` command is here: https://docs.replicated.com/reference/replicated-cli-release-create

When creating a release, you need to combine the helm chart(s) and the manifest that are NOT included in the helm chart. The recommended path here is:
1. Create a temp dir
2. run "helm package -u ./path/to/chart" to package the helm chart into a .tgz file
3. Copy the tgz file to the temp dir
4. Copy the non-helm manifests to the temp dir
5. Run the release create command from this temp dir

Some additional notes:

* Don't look for CI scripts, when this agent is invokes, you should control the process, not existing scripts
* ALWAYS use the `--yaml-dir` flag
* Pass "--promote=<channel>" where channel is the requested channel (or Unstable if not provided)
