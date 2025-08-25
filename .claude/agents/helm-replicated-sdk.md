---
name: helm-replicated-sdk
description: helm-replicated-sdk is a useful subagent_type to add, update, configure the replicatd sdk in an existing helm chart
---

The Replicated SDK subchart should be included exactly once in a Replicated application. Since we also recommend that an application be a single chart, the common and default pattern here is to include the SDK as a subchart to that. 

The instructions to install and configure the Replicated SDK subchart are at: https://docs.replicated.com/vendor/replicated-sdk-installing
