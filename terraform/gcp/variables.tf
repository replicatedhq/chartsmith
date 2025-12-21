# =============================================================================
# ENVIRONMENT IDENTIFICATION
# =============================================================================
variable "environment_name" {
  description = "Environment name for this Chartsmith deployment (e.g., 'production', 'staging', 'dev')"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.environment_name))
    error_message = "Environment name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "gcp_project" {
  description = "GCP project ID for deployment"
  type        = string
}

variable "gcp_region" {
  description = "GCP region for deployment"
  type        = string
  default     = "us-central1"
}

# =============================================================================
# INFRASTRUCTURE CHOICES
# =============================================================================
variable "create_vpc" {
  description = "Create a new VPC for Chartsmith"
  type        = bool
  default     = true
}

variable "create_gke_cluster" {
  description = "Create a new GKE cluster for Chartsmith"
  type        = bool
  default     = true
}

variable "create_database" {
  description = "Create a new Cloud SQL PostgreSQL database for Chartsmith"
  type        = bool
  default     = true
}

# =============================================================================
# EXISTING INFRASTRUCTURE
# =============================================================================
variable "existing_network_name" {
  description = "Name of existing VPC network (required if create_vpc = false)"
  type        = string
  default     = ""
}

variable "existing_network_id" {
  description = "ID of existing VPC network (required if create_vpc = false)"
  type        = string
  default     = ""
}

variable "existing_subnet_name" {
  description = "Name of existing subnet (required if create_vpc = false)"
  type        = string
  default     = ""
}

variable "existing_pods_range_name" {
  description = "Name of existing pods secondary IP range (required if create_vpc = false)"
  type        = string
  default     = ""
}

variable "existing_services_range_name" {
  description = "Name of existing services secondary IP range (required if create_vpc = false)"
  type        = string
  default     = ""
}

variable "existing_cluster_name" {
  description = "Name of existing GKE cluster (required if create_gke_cluster = false)"
  type        = string
  default     = ""
}

variable "existing_database_instance" {
  description = "Name of existing Cloud SQL instance (required if create_database = false)"
  type        = string
  default     = ""
}

# =============================================================================
# VPC CONFIGURATION
# =============================================================================
variable "subnet_cidr" {
  description = "CIDR block for subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "pods_secondary_range" {
  description = "Secondary IP range for pods"
  type        = string
  default     = "10.4.0.0/14"
}

variable "services_secondary_range" {
  description = "Secondary IP range for services"
  type        = string
  default     = "10.8.0.0/20"
}

# =============================================================================
# GKE CONFIGURATION
# =============================================================================
variable "kubernetes_version" {
  description = "Kubernetes version for GKE cluster"
  type        = string
  default     = "1.28"
}

variable "node_pools" {
  description = "GKE node pool configurations"
  type = map(object({
    machine_type       = string
    min_node_count     = number
    max_node_count     = number
    initial_node_count = number
    disk_size_gb       = number
    disk_type          = optional(string, "pd-standard")
    preemptible        = optional(bool, false)
    spot               = optional(bool, false)
    labels             = optional(map(string), {})
    taints = optional(list(object({
      key    = string
      value  = string
      effect = string
    })), [])
  }))
  default = {
    main = {
      machine_type       = "n1-standard-2"
      min_node_count     = 2
      max_node_count     = 10
      initial_node_count = 3
      disk_size_gb       = 50
    }
  }
}

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
variable "database_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-custom-2-7680"
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "database_availability_type" {
  description = "Availability type (ZONAL or REGIONAL)"
  type        = string
  default     = "ZONAL"
}

variable "database_disk_size" {
  description = "Disk size for Cloud SQL instance (GB)"
  type        = number
  default     = 100
}

variable "database_disk_autoresize_limit" {
  description = "Maximum disk size for autoresize (GB)"
  type        = number
  default     = 500
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
  default     = "chartsmith"
}

variable "database_username" {
  description = "Username for database"
  type        = string
  default     = "chartsmith"
}

# =============================================================================
# SECURITY
# =============================================================================
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access Chartsmith"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# =============================================================================
# BACKUP CONFIGURATION
# =============================================================================
variable "backup_start_time" {
  description = "Preferred backup start time (HH:MM)"
  type        = string
  default     = "03:00"
}

# =============================================================================
# OPTIONAL FEATURES
# =============================================================================
variable "enable_nat_gateway" {
  description = "Enable Cloud NAT for private nodes"
  type        = bool
  default     = true
}

# =============================================================================
# LABELS
# =============================================================================
variable "labels" {
  description = "Additional labels to apply to all resources"
  type        = map(string)
  default = {
    application = "chartsmith"
    managed_by  = "terraform"
  }
}
