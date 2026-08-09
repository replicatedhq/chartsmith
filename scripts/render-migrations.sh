#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
schema_dir="${repo_root}/db/schema/tables"
output="${1:--}"

render_migrations() {
  local found=false
  local migration
  local name

  for migration in "${schema_dir}"/*.yaml; do
    if [[ ! -f "${migration}" ]]; then
      continue
    fi

    found=true
    name="$(basename "${migration}" .yaml)"

    printf '%s\n' '---'
    printf '%s\n' 'apiVersion: schemas.schemahero.io/v1alpha4'
    printf '%s\n' 'kind: Table'
    printf '%s\n' 'metadata:'
    printf '  name: %s\n' "${name}"
    printf '%s\n' '  namespace: chartsmith'
    printf '%s\n' 'spec:'
    sed 's/^/  /' "${migration}"
    printf '\n'
  done

  if [[ "${found}" != true ]]; then
    echo "No table migrations found in ${schema_dir}" >&2
    return 1
  fi
}

if [[ "${output}" == "-" ]]; then
  render_migrations
else
  mkdir -p "$(dirname "${output}")"
  render_migrations >"${output}"
  echo "Rendered migrations to ${output}" >&2
fi
