# Chartsmith disaster recovery

Chartsmith opts into Embedded Cluster's disaster-recovery lifecycle extension
as of release `0.3.7`. The extension installs and owns Velero, storage setup,
backup schedules and retention, the admin-console workflow, and restore.
Embedded Cluster itself does not install Velero for applications that omit the
lifecycle declaration.

For the embedded PostgreSQL option, Chartsmith's pod annotations create a
logical `pg_dump` before each backup. Only that dump is copied; the live
PostgreSQL data volume is deliberately excluded. During restore, Velero restores
the dump into an `emptyDir`, waits for the new PostgreSQL pod to be ready, and
runs `pg_restore`. A failed dump or restore hook fails the recovery operation.

An external PostgreSQL database is outside the Embedded Cluster cluster and is
not protected by this workflow. Operators using that option must back up and
restore the external database with the database provider's tooling to a point
consistent with the selected Chartsmith recovery point.

Release packaging runs `make prepare-dr-extension`, which pulls the pinned
`0.1.0` extension chart and includes it in the Replicated release. For local
validation before that chart is published, point the preparation script at a
locally built package:

```sh
DR_EXTENSION_CHART_ARCHIVE=/path/to/embedded-cluster-disaster-recovery-0.1.0.tgz \
  make prepare-dr-extension
```

The script XZ-decompresses the chart's bootstrap artifacts and verifies the
executable hashes declared in `replicated/ec.yaml`. The staged
`.release-charts` directory is generated and ignored by Git.
