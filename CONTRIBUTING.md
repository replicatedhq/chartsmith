# Contributing

This doc is a guide for how engineers at Replicated contribute to this project.

## Development

We use Okteto and run the dev environment in Kubernetes.
To get started, clone this repo and run: `okteto pipeline deploy`.

There are two components you'll want to be able to iterate on commonly:

### `chartsmith-app`
This is the next.js application that is the web ui. When you run `okteto up chartsmith-app` it will start a watch and rebuild the app on file changes. Visit your okteto dashboard for the URL.

### `chartsmith-worker`
This is the Go worker that is the backend. When you run `okteto up chartsmith-worker` you will get a shell and you need to run `make run-worker` to start the worker. After changes, press `Ctrl+C` to stop the worker and run `make run-worker` again to restart it.

### `chartsmith-migrations`
This is the database migrations that are used to create the database schema. When you run `okteto up chartsmith-migrations` you will get a shell and you need to run `make run-migrations` to start the migrations.

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




