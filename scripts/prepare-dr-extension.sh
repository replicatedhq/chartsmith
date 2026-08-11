#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
version="${DR_EXTENSION_VERSION:-0.1.0}"
archive="${DR_EXTENSION_CHART_ARCHIVE:-}"
charts_dir="${repo_root}/.release-charts"
target="${charts_dir}/embedded-cluster-disaster-recovery"
staging="$(mktemp -d "${TMPDIR:-/tmp}/chartsmith-dr-extension.XXXXXX")"

cleanup() {
  rm -rf "${staging}"
}
trap cleanup EXIT

if [[ -n "${archive}" ]]; then
  test -f "${archive}"
  tar -xzf "${archive}" -C "${staging}"
else
  command -v helm >/dev/null 2>&1
  helm pull \
    oci://ghcr.io/replicatedhq/charts/embedded-cluster-disaster-recovery \
    --version "${version}" \
    --untar \
    --untardir "${staging}"
fi

staged="${staging}/embedded-cluster-disaster-recovery"
test -s "${staged}/Chart.yaml"
test -s "${staged}/bootstrap/linux-amd64/embedded-cluster-dr.xz"
test -s "${staged}/bootstrap/linux-arm64/embedded-cluster-dr.xz"
command -v xz >/dev/null 2>&1

actual_version="$(awk '$0 ~ /^version:/ { print $2; exit }' "${staged}/Chart.yaml")"
if [[ "${actual_version}" != "${version}" ]]; then
  echo "Expected disaster-recovery extension ${version}, found ${actual_version}" >&2
  exit 1
fi

expected_amd64="$(awk '$1 == "arch:" { arch=$2 } $1 == "sha256:" && arch == "amd64" { print $2; exit }' "${repo_root}/replicated/ec.yaml")"
expected_arm64="$(awk '$1 == "arch:" { arch=$2 } $1 == "sha256:" && arch == "arm64" { print $2; exit }' "${repo_root}/replicated/ec.yaml")"
xz -dc "${staged}/bootstrap/linux-amd64/embedded-cluster-dr.xz" > "${staging}/embedded-cluster-dr-linux-amd64"
xz -dc "${staged}/bootstrap/linux-arm64/embedded-cluster-dr.xz" > "${staging}/embedded-cluster-dr-linux-arm64"
actual_amd64="$(shasum -a 256 "${staging}/embedded-cluster-dr-linux-amd64" | awk '{ print $1 }')"
actual_arm64="$(shasum -a 256 "${staging}/embedded-cluster-dr-linux-arm64" | awk '{ print $1 }')"
if [[ "${actual_amd64}" != "${expected_amd64}" || "${actual_arm64}" != "${expected_arm64}" ]]; then
  echo "Disaster-recovery bootstrap checksum does not match replicated/ec.yaml" >&2
  exit 1
fi

mkdir -p "${charts_dir}"
rm -rf "${target}"
mv "${staged}" "${target}"

echo "Prepared embedded-cluster-disaster-recovery ${version}"
