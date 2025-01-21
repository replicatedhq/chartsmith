package llm

const initialPlanInstructions = `
- Give me a high-level plan for thte user request provided here. Summarize for the user what you will do. Do NOT provide the actual code changes yet.
- Include what you plan to name the chart.
- Include a high level description of how you plan to test this chart (without providing specific bash commands).
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
