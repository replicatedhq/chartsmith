# =============================================================================
# CHARTSMITH GCP DEPLOYMENT
# Complete GCP infrastructure for self-hosted Chartsmith
# =============================================================================

locals {
  name_prefix = "chartsmith-${var.environment_name}"

  common_labels = merge(var.labels, {
    application    = "chartsmith"
    environment    = var.environment_name
    managed_by     = "terraform"
    cloud_provider = "gcp"
  })

  # Determine which network/subnets to use based on whether VPC is created or existing
  network_name    = var.create_vpc ? module.vpc[0].network_name : var.existing_network_name
  subnet_name     = var.create_vpc ? module.vpc[0].subnet_name : var.existing_subnet_name
  pods_range_name = var.create_vpc ? module.vpc[0].pods_range_name : var.existing_pods_range_name
  services_range_name = var.create_vpc ? module.vpc[0].services_range_name : var.existing_services_range_name
}

# =============================================================================
# VALIDATION CHECKS
# =============================================================================
resource "terraform_data" "validate_existing_vpc_config" {
  count = var.create_vpc ? 0 : 1

  lifecycle {
    precondition {
      condition     = var.existing_network_name != ""
      error_message = "When using existing VPC (create_vpc = false), you must provide existing_network_name."
    }

    precondition {
      condition     = var.existing_subnet_name != ""
      error_message = "When using existing VPC (create_vpc = false), you must provide existing_subnet_name."
    }
  }
}

# =============================================================================
# VPC MODULE
# =============================================================================
module "vpc" {
  count  = var.create_vpc ? 1 : 0
  source = "./modules/vpc"

  project_id  = var.gcp_project
  name_prefix = local.name_prefix
  region      = var.gcp_region

  subnet_cidr              = var.subnet_cidr
  pods_secondary_range     = var.pods_secondary_range
  services_secondary_range = var.services_secondary_range

  enable_nat_gateway = var.enable_nat_gateway

  labels = local.common_labels
}

# =============================================================================
# SECURITY (Firewall Rules)
# =============================================================================
module "security" {
  source = "./modules/security"

  project_id   = var.gcp_project
  network_name = local.network_name
  name_prefix  = local.name_prefix

  allowed_cidr_blocks = var.allowed_cidr_blocks

  labels = local.common_labels

  depends_on = [module.vpc]
}

# =============================================================================
# DATABASE CREDENTIALS SECRET
# =============================================================================
resource "google_secret_manager_secret" "database_credentials" {
  count = var.create_database ? 1 : 0

  project   = var.gcp_project
  secret_id = "${local.name_prefix}-database-credentials"

  replication {
    auto {}
  }

  labels = merge(local.common_labels, {
    component = "database"
  })
}

resource "google_secret_manager_secret_version" "database_credentials" {
  count = var.create_database ? 1 : 0

  secret = google_secret_manager_secret.database_credentials[0].id
  secret_data = jsonencode({
    host              = module.cloudsql[0].private_ip_address
    port              = 5432
    database          = module.cloudsql[0].database_name
    username          = module.cloudsql[0].username
    password          = module.cloudsql[0].password
    connection_string = module.cloudsql[0].connection_string
  })

  depends_on = [module.cloudsql]
}

# =============================================================================
# CLOUD SQL POSTGRESQL MODULE
# =============================================================================
module "cloudsql" {
  count  = var.create_database ? 1 : 0
  source = "./modules/cloudsql"

  project_id  = var.gcp_project
  name_prefix = local.name_prefix
  region      = var.gcp_region

  # Instance configuration
  tier                  = var.database_tier
  database_version      = var.database_version
  availability_type     = var.database_availability_type
  disk_size             = var.database_disk_size
  disk_autoresize       = true
  disk_autoresize_limit = var.database_disk_autoresize_limit

  # Database configuration
  database_name = var.database_name
  username      = var.database_username

  # Network configuration
  network_id          = local.network_name
  private_network     = var.create_vpc ? module.vpc[0].network_id : var.existing_network_id

  # Backup configuration
  backup_enabled       = true
  backup_start_time    = var.backup_start_time
  point_in_time_recovery_enabled = true

  # Security
  deletion_protection = true

  labels = local.common_labels

  depends_on = [module.vpc]
}

# =============================================================================
# GKE CLUSTER MODULE
# =============================================================================
module "gke" {
  count  = var.create_gke_cluster ? 1 : 0
  source = "./modules/gke"

  project_id   = var.gcp_project
  cluster_name = "${local.name_prefix}-gke"
  region       = var.gcp_region

  network_name              = local.network_name
  subnet_name               = local.subnet_name
  pods_secondary_range_name = local.pods_range_name
  services_secondary_range_name = local.services_range_name

  # Kubernetes version
  kubernetes_version = var.kubernetes_version

  # Node pools configuration
  node_pools = var.node_pools

  # Logging and monitoring
  logging_service    = "logging.googleapis.com/kubernetes"
  monitoring_service = "monitoring.googleapis.com/kubernetes"

  # Security
  enable_workload_identity = true
  enable_shielded_nodes    = true

  labels = local.common_labels

  depends_on = [module.vpc, module.security]
}
