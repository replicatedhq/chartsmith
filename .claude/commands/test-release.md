# Test Release on Replicated

You are tasked with testing a release on Replicated. This command allows you to understand the goals and perform the requested tests.

## Parameters

The user MAY provide parameters in the request:

| Parameter Name | Required? | Description | Default |
|----------------|-----------|-------------|---------|
| App Slug | yes | The app slug (from Replicated) that we are installing | |
| Customer ID | yes, if license if is not provided | The "customer Id" from replicated | |
| License ID | no | the secret (license id) from replicated for the customer | |
| Install Method | yes | the install method ("ec/embedded cluster", "helm", "kots") | "helm" |
| Helm Values.yaml file path | no | |

## Initial Response

If there are unset required parameters, first prompt the user for the missing data.

Once you have all required parameters, respond with:

```
I am creating a CMX [vm/cluster (choose cluster for kots and helm, vm for ec)] to test the application on.
```

## IMPORTANT LIFECYCLE 

* You should ask the user if they want to keep the CMX instances or delete them. If you keep them, on subsequent runs, assume that the user wants to re-use that same instance. The user will tell you if this is not desired.


## Perform the test

1. Create the CMX instance (cluster or vm) (use the `replicated-cli-user` agent for this)
2. For KOTS and EC, download the license using the Replicated CLI
3. For Helm, log in to the registry.

