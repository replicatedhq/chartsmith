Here's how we will convert k8s manifests to helm charts.


1.	Pre-processing: 
    - If a manifest is not a valid k8s manifest (kubeval), discard it
    - Sort manifests by GVK, we want to order them: [configmaps, secrets, other]
2.	Conversion Loop: 
    - Iterate through the manifests, sending each on to the LLM along with the aggregated values.yaml so far. Store the output of the values.yaml at each step.
    - The LLM will return a helm template, and an updated values.yaml
3.  Post-processing: 
    - Once completed, send the final values.yaml back to the LLM to be simplified.
    - Send each manifest back to the LLM to be refactored to use the values.yaml now.  
