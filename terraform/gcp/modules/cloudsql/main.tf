# Cloud SQL PostgreSQL Module

resource "random_password" "database_password" {
  length  = 32
  special = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "google_sql_database_instance" "main" {
  name             = "${var.name_prefix}-postgres"
  project          = var.project_id
  region           = var.region
  database_version = var.database_version

  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    availability_type = var.availability_type
    disk_size         = var.disk_size
    disk_autoresize   = var.disk_autoresize
    disk_autoresize_limit = var.disk_autoresize_limit

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.private_network
      require_ssl     = true
    }

    backup_configuration {
      enabled                        = var.backup_enabled
      start_time                     = var.backup_start_time
      point_in_time_recovery_enabled = var.point_in_time_recovery_enabled
      transaction_log_retention_days = 7
    }

    database_flags {
      name  = "cloudsql.enable_pgvector"
      value = "on"
    }
  }
}

resource "google_sql_database" "main" {
  name     = var.database_name
  project  = var.project_id
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "main" {
  name     = var.username
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  password = random_password.database_password.result
}
