# =============================================================================
# GCP DEPLOYMENT OUTPUTS
# Information customers get after successful deployment
# =============================================================================

# =============================================================================
# DEPLOYMENT INFORMATION
# =============================================================================
output "deployment_info" {
  description = "Summary of deployment information"
  value = {
    environment_name = var.environment_name
    gcp_project      = var.gcp_project
    gcp_region       = var.gcp_region
    vpc_created      = var.create_vpc
    gke_created      = var.create_gke_cluster
    database_created = var.create_database
    cluster_name     = var.create_gke_cluster ? module.gke[0].cluster_name : var.existing_cluster_name
  }
}

# =============================================================================
# NETWORK INFORMATION
# =============================================================================
output "vpc_info" {
  description = "VPC network information"
  value = var.create_vpc ? {
    network_name        = module.vpc[0].network_name
    network_id          = module.vpc[0].network_id
    subnet_name         = module.vpc[0].subnet_name
    subnet_cidr         = module.vpc[0].subnet_cidr
    pods_range_name     = module.vpc[0].pods_range_name
    services_range_name = module.vpc[0].services_range_name
    region              = var.gcp_region
    } : {
    network_name = var.existing_network_name
    message      = "Using existing VPC"
  }
}

# =============================================================================
# DATABASE INFORMATION
# =============================================================================
output "database_info" {
  description = "Cloud SQL connection information"
  value = var.create_database ? {
    instance_name        = module.cloudsql[0].instance_name
    connection_name      = module.cloudsql[0].connection_name
    private_ip_address   = module.cloudsql[0].private_ip_address
    database_name        = module.cloudsql[0].database_name
    database_version     = module.cloudsql[0].database_version
    tier                 = var.database_tier
    availability_type    = var.database_availability_type
    } : {
    instance_name = var.existing_database_instance
    message       = "Using existing Cloud SQL instance"
  }
  sensitive = true
}

# =============================================================================
# GKE CLUSTER INFORMATION
# =============================================================================
output "gke_info" {
  description = "GKE cluster information"
  value = var.create_gke_cluster ? {
    cluster_name     = module.gke[0].cluster_name
    cluster_endpoint = module.gke[0].cluster_endpoint
    cluster_version  = module.gke[0].cluster_version
    node_pools       = keys(var.node_pools)
    kubectl_config   = "gcloud container clusters get-credentials ${module.gke[0].cluster_name} --region ${var.gcp_region} --project ${var.gcp_project}"
    } : {
    cluster_name = var.existing_cluster_name
    message      = "Using existing GKE cluster"
  }
}

# =============================================================================
# SECRETS INFORMATION
# =============================================================================
output "secrets_info" {
  description = "Information about created secrets"
  value = {
    secrets_created = var.create_database ? ["database-credentials"] : []
    project         = var.gcp_project
  }
}

# =============================================================================
# NEXT STEPS FOR CUSTOMER
# =============================================================================
output "next_steps" {
  description = "What to do after deployment"
  value       = <<-EOT
    ✅ Chartsmith GCP infrastructure deployed successfully!

    📋 What was created:
    ${var.create_vpc ? "- VPC network with subnets and secondary ranges for GKE" : "- Used existing VPC"}
    ${var.create_gke_cluster ? "- GKE cluster with managed node pools and Workload Identity" : "- Configured for existing GKE cluster"}
    ${var.create_database ? "- Cloud SQL PostgreSQL database with pgvector extension" : "- Configured for existing database"}
    - Firewall rules for GKE cluster and Cloud SQL
    ${var.create_database ? "- Database credentials in Secret Manager" : ""}

    📚 Resources:
    - Project: ${var.gcp_project}
    - Network: ${local.network_name}
    ${var.create_gke_cluster ? "- GKE Cluster: ${module.gke[0].cluster_name}" : "- GKE Cluster: ${var.existing_cluster_name} (existing)"}
    - Database: ${var.create_database ? module.cloudsql[0].connection_name : var.existing_database_instance}
    ${var.create_database ? "- Database credentials: Secret Manager in ${var.gcp_project}" : ""}

    🔧 Manual steps required:
    1. Configure kubectl access: ${var.create_gke_cluster ? "gcloud container clusters get-credentials ${module.gke[0].cluster_name} --region ${var.gcp_region} --project ${var.gcp_project}" : "gcloud container clusters get-credentials ${var.existing_cluster_name}"}
    2. Deploy Chartsmith via Helm
    3. Verify database connectivity and pgvector extension

  EOT
}

# =============================================================================
# TERRAFORM STATE INFORMATION
# =============================================================================
output "terraform_info" {
  description = "Terraform state information"
  value = {
    terraform_version = "~> 1.5"
    gcp_provider_version = "~> 5.0"
    project    = var.gcp_project
    region     = var.gcp_region
    state_backend = "Configure remote state backend for production use"
  }
}

# =============================================================================
# SENSITIVE OUTPUTS (for automation)
# =============================================================================
output "database_connection_string" {
  description = "Database connection string"
  value       = var.create_database ? module.cloudsql[0].connection_string : "Configure manually for existing database"
  sensitive   = true
}

output "database_secret_id" {
  description = "Secret Manager secret ID for database credentials"
  value       = var.create_database ? google_secret_manager_secret.database_credentials[0].secret_id : null
  sensitive   = true
}
