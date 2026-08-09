#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"

version="${1:-}"
platform="${PLATFORM:-linux/amd64}"

if [[ -z "${version}" ]]; then
  echo "Usage: $0 VERSION" >&2
  exit 1
fi

if [[ "${version}" == *[!A-Za-z0-9_.-]* ]]; then
  echo "Version contains characters that are invalid in a container tag: ${version}" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to build release images" >&2
  exit 1
fi

deploy_time="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

echo "Building chartsmith-worker:${version} for ${platform}"
docker build \
  --platform "${platform}" \
  --progress plain \
  --file "${repo_root}/Dockerfile.worker" \
  --tag "chartsmith-worker:${version}" \
  "${repo_root}"

echo "Building chartsmith-app:${version} for ${platform}"
docker build \
  --platform "${platform}" \
  --progress plain \
  --build-arg "DEPLOY_TIME=${deploy_time}" \
  --build-arg "VERSION=${version}" \
  --file "${repo_root}/chartsmith-app/Dockerfile" \
  --tag "chartsmith-app:${version}" \
  "${repo_root}/chartsmith-app"

echo "Built chartsmith-worker:${version} and chartsmith-app:${version}"
