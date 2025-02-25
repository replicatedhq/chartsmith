# Contributing

This doc is a guide for how engineers at Replicated contribute to this project.

## Development

There are 2 services plus a postgres database with pgvector.

YOu can start a local copy of the database with `make run-postgres`. You do need docker.




## Release

All releases are automated using various Dagger functions.

```
make validate
```

The validate function will run all the tests and linting checks.

```
make release version=[patch|minor|major]
```

The release function will create a new release tag and push all container images to the appropriate registries and the K8s manifests to gitops repo.




