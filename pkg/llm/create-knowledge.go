package llm

const detailedPlanInstructions = `
- Provide a detailed plan for the high level plan outlined here.
`

const chatOnlyInstructions = `
- You will be asked to answer a question.
- You will be given the question and the context of the question.
- You will be given the current chat history.
- You will be asked to answer the question based on the context and the chat history.
- You can be technical in your response and include inline code snippets identifed with Markdown when appropriate.
- Never use the <chartsmithArtifact> tag in your response.
`

const initialPlanInstructions = `
- Describe a general plan for creating a new helm chart based on the user request.
- The user will provide a chart to start from. You shoud be inspired by this, but it's not important to copy it exactly.
- Refer the the process as "creating" a chart, not "editing" a chart.
- The user is a developer who understands Helm and Kubernetes.
- You can be technical in your response, but don't write code.
- Avoid refering to the base chart in your response. For the purpose of this plan, you will describe your plan as if you are creating a new chart.
- Minimize the use of bullet lists in your response.
- Be specific when describing the types of environments and versions of Kubernetes and Helm you will support.
- Be specific when describing any and all end customer requirements you are aware of.
- Be specific when describing any dependencies you are including.
`

const createKnowledge = `
- If the chart is named 'new-chart', rename it to an appopriate name. The word "replicated" is not part of the name.
- If the chart is named 'new-chart', don't share that we are editing a chart or transforming a chart. Phrase everything as if we are creating a new chart.
- Never mention renaming the chart.
- If there is a replicated subchart defined, do not remove it.
- Modify this chart to meet the plan.
- Add sufficient comments to the values.yaml file so that someone can install it.
- List all images in the values.yaml, splitting the repo, image, and tag into separate fields.
- Ensure that all images can be pulled with an image pull secret. Assume that the user may have a local repository to pull from.
- The default location of images will be "proxy.replicated.com/appslug"
- Never include multiple YAML documents in the same file. Split them into separate files.
- Don't include more than 5-7 env vars in a deployment. If they get longer, mount from a configmap or secret.
`
