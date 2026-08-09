#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"

github_repo="${CHARTSMITH_GITHUB_REPO:-replicatedhq/chartsmith}"
gitops_repo="${CHARTSMITH_GITOPS_REPO:-replicatedcom/gitops-deploy}"
op_vault_uuid="${CHARTSMITH_OP_VAULT_UUID:-4r7lasfjeevrao4qi4wsqgnn6e}"
region="${AWS_REGION:-us-east-1}"

requested_version=""
build=true
staging=true
production=false

usage() {
  cat <<'USAGE'
Usage: scripts/release.sh --version VERSION [options]

VERSION may be an explicit version or one of: major, minor, patch.

Options:
  --no-build      Do not tag, build, or push images, or create a GitHub release.
  --no-staging    Do not update the staging GitOps branch.
  --production    Update the production GitOps branch.
  -h, --help      Show this help.
USAGE
}

die() {
  echo "Error: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      [[ $# -ge 2 ]] || die "--version requires a value"
      requested_version="$2"
      shift 2
      ;;
    --no-build)
      build=false
      shift
      ;;
    --no-staging)
      staging=false
      shift
      ;;
    --production)
      production=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[[ -n "${requested_version}" ]] || die "--version is required"

require_command gh
require_command git

github_token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
[[ -n "${github_token}" ]] || die "GITHUB_TOKEN is required"
export GH_TOKEN="${github_token}"

if [[ "${build}" == true ]]; then
  require_command aws
  require_command docker
  require_command op
fi

if [[ "${staging}" == true || "${production}" == true ]]; then
  require_command kustomize
  require_command op
fi

if [[ "${build}" == true || "${staging}" == true || "${production}" == true ]]; then
  op_service_account_token="${OP_SERVICE_ACCOUNT_PRODUCTION:-}"
  [[ -n "${op_service_account_token}" ]] || die "OP_SERVICE_ACCOUNT_PRODUCTION is required"
fi

latest_version="$(gh release view --repo "${github_repo}" --json tagName --jq .tagName 2>/dev/null || true)"
if [[ -z "${latest_version}" ]]; then
  latest_version="0.0.0"
fi

resolve_version() {
  local bump="$1"
  local major
  local minor
  local patch

  case "${bump}" in
    major|minor|patch)
      if [[ ! "${latest_version}" =~ ^v?([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
        die "latest release is not semantic versioning compatible: ${latest_version}"
      fi
      major="${BASH_REMATCH[1]}"
      minor="${BASH_REMATCH[2]}"
      patch="${BASH_REMATCH[3]}"

      case "${bump}" in
        major) printf '%d.0.0\n' "$((major + 1))" ;;
        minor) printf '%d.%d.0\n' "${major}" "$((minor + 1))" ;;
        patch) printf '%d.%d.%d\n' "${major}" "${minor}" "$((patch + 1))" ;;
      esac
      ;;
    *)
      printf '%s\n' "${bump}"
      ;;
  esac
}

new_version="$(resolve_version "${requested_version}")"
if [[ "${new_version}" == *[!A-Za-z0-9_.-]* ]]; then
  die "version contains characters that are invalid in a container tag: ${new_version}"
fi

echo "Releasing ${latest_version} -> ${new_version} (build=${build}, staging=${staging}, production=${production})"

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/chartsmith-release.XXXXXX")"
cleanup() {
  rm -rf "${temp_dir}"
}
trap cleanup EXIT

op_read() {
  local item="$1"
  local field="$2"

  OP_SERVICE_ACCOUNT_TOKEN="${op_service_account_token}" \
    op read "op://${op_vault_uuid}/${item}/${field}"
}

create_release_tag() {
  local sha

  if gh api "repos/${github_repo}/git/ref/tags/${new_version}" >/dev/null 2>&1; then
    die "tag ${new_version} already exists; refusing to replace it"
  fi

  sha="$(git -C "${repo_root}" rev-parse HEAD)"
  gh api \
    --method POST \
    "repos/${github_repo}/git/refs" \
    -f "ref=refs/tags/${new_version}" \
    -f "sha=${sha}" \
    >/dev/null

  echo "Created tag ${new_version} at ${sha}"
}

push_ecr_image() {
  local local_image="$1"
  local image_name="$2"
  local account_id="$3"
  local access_key_id="$4"
  local secret_access_key="$5"
  local registry="${account_id}.dkr.ecr.${region}.amazonaws.com"
  local remote_image="${registry}/${image_name}:${new_version}"

  AWS_ACCESS_KEY_ID="${access_key_id}" \
    AWS_SECRET_ACCESS_KEY="${secret_access_key}" \
    AWS_REGION="${region}" \
    aws ecr get-login-password --region "${region}" \
    | docker login --username AWS --password-stdin "${registry}"

  docker tag "${local_image}" "${remote_image}"
  docker push "${remote_image}"
  echo "Pushed ${remote_image}"
}

build_and_push_images() {
  local staging_access_key_id
  local staging_secret_access_key
  local production_access_key_id
  local production_secret_access_key
  local dockerhub_username
  local dockerhub_password
  local image_name

  staging_account_id="$(op_read 'Chartsmith - Staging Push' account_id)"
  staging_access_key_id="$(op_read 'Chartsmith - Staging Push' access_key_id)"
  staging_secret_access_key="$(op_read 'Chartsmith - Staging Push' secret_access_key)"
  production_account_id="$(op_read 'Chartsmith - Production Push' account_id)"
  production_access_key_id="$(op_read 'Chartsmith - Production Push' access_key_id)"
  production_secret_access_key="$(op_read 'Chartsmith - Production Push' secret_access_key)"
  dockerhub_username="$(op_read 'DockerHub ChartSmith Release' username)"
  dockerhub_password="$(op_read 'DockerHub ChartSmith Release' password)"

  "${script_dir}/build-images.sh" "${new_version}"

  printf '%s' "${dockerhub_password}" | docker login \
    --username "${dockerhub_username}" \
    --password-stdin \
    index.docker.io

  for image_name in chartsmith-worker chartsmith-app; do
    push_ecr_image \
      "${image_name}:${new_version}" \
      "${image_name}" \
      "${staging_account_id}" \
      "${staging_access_key_id}" \
      "${staging_secret_access_key}"

    push_ecr_image \
      "${image_name}:${new_version}" \
      "${image_name}" \
      "${production_account_id}" \
      "${production_access_key_id}" \
      "${production_secret_access_key}"

    docker tag "${image_name}:${new_version}" "chartsmith/${image_name}:${new_version}"
    docker push "chartsmith/${image_name}:${new_version}"
    echo "Pushed chartsmith/${image_name}:${new_version}"
  done
}

deploy_environment() {
  local environment="$1"
  local branch="$2"
  local account_id="$3"
  local environment_dir="${temp_dir}/${environment}"
  local checkout_dir="${environment_dir}/gitops"
  local kustomize_dir="${environment_dir}/kustomize"
  local manifests_file="${environment_dir}/chartsmith.yaml"
  local migrations_file="${environment_dir}/migrations.yaml"
  local registry="${account_id}.dkr.ecr.${region}.amazonaws.com"

  mkdir -p "${environment_dir}"
  cp -R "${repo_root}/kustomize" "${kustomize_dir}"

  (
    cd "${kustomize_dir}/overlays/${environment}"
    kustomize edit set namespace chartsmith
    kustomize edit set image \
      "chartsmith-worker=${registry}/chartsmith-worker:${new_version}" \
      "chartsmith-app=${registry}/chartsmith-app:${new_version}"
  )
  kustomize build "${kustomize_dir}/overlays/${environment}" >"${manifests_file}"
  "${script_dir}/render-migrations.sh" "${migrations_file}"

  gh repo clone "${gitops_repo}" "${checkout_dir}" -- \
    --branch "${branch}" \
    --single-branch

  mkdir -p "${checkout_dir}/chartsmith"
  cp "${repo_root}/db/database.yaml" "${checkout_dir}/chartsmith/database.yaml"
  cp "${migrations_file}" "${checkout_dir}/chartsmith/migrations.yaml"
  cp "${manifests_file}" "${checkout_dir}/chartsmith/chartsmith.yaml"

  git -C "${checkout_dir}" config user.name "Chartsmith Release"
  git -C "${checkout_dir}" config user.email "release@replicated.com"
  git -C "${checkout_dir}" add \
    chartsmith/database.yaml \
    chartsmith/migrations.yaml \
    chartsmith/chartsmith.yaml

  if git -C "${checkout_dir}" diff --cached --quiet; then
    echo "No ${environment} GitOps changes to commit"
    return
  fi

  git -C "${checkout_dir}" commit -m "Update Chartsmith deployment to ${new_version}"
  git -C "${checkout_dir}" push origin "HEAD:${branch}"
}

staging_account_id=""
production_account_id=""

if [[ "${build}" == true ]]; then
  if [[ -n "$(git -C "${repo_root}" status --porcelain --untracked-files=no)" ]]; then
    die "the working tree has tracked changes; commit them before releasing"
  fi
  create_release_tag
  build_and_push_images
fi

if [[ "${staging}" == true ]]; then
  if [[ -z "${staging_account_id}" ]]; then
    staging_account_id="$(op_read 'Chartsmith - Staging Push' account_id)"
  fi
  deploy_environment staging main "${staging_account_id}"
fi

if [[ "${production}" == true ]]; then
  if [[ -z "${production_account_id}" ]]; then
    production_account_id="$(op_read 'Chartsmith - Production Push' account_id)"
  fi
  deploy_environment production release "${production_account_id}"
fi

if [[ "${build}" == true ]]; then
  gh release create "${new_version}" \
    --repo "${github_repo}" \
    --title "${new_version}" \
    --notes "" \
    --verify-tag
fi

echo "Release ${new_version} completed"
