# =============================================================================
# ENVIRONMENT IDENTIFICATION
# =============================================================================
variable "environment_name" {
  description = "Environment name for this Chartsmith deployment (e.g., 'production', 'staging', 'dev')"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9-]+$", var.environment_name))
    error_message = "Environment name must contain only letters, numbers, and hyphens."
  }
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-west-2"
}

# =============================================================================
# INFRASTRUCTURE CHOICES
# =============================================================================
variable "create_vpc" {
  description = "Create a new VPC for Chartsmith"
  type        = bool
  default     = true
}

variable "create_eks_cluster" {
  description = "Create a new EKS cluster for Chartsmith"
  type        = bool
  default     = true
}

variable "create_database" {
  description = "Create a new PostgreSQL database for Chartsmith"
  type        = bool
  default     = true
}


# =============================================================================
# EXISTING INFRASTRUCTURE
# =============================================================================
variable "existing_vpc_id" {
  description = "ID of existing VPC (required if create_vpc = false)"
  type        = string
  default     = ""

  validation {
    condition     = var.create_vpc || var.existing_vpc_id != ""
    error_message = "When using existing VPC (create_vpc = false), you must provide existing_vpc_id."
  }
}

variable "existing_subnet_ids" {
  description = "Private subnet IDs in existing VPC (required if create_vpc = false)"
  type        = list(string)
  default     = []

  validation {
    condition     = var.create_vpc || length(var.existing_subnet_ids) >= 2
    error_message = "When using existing VPC (create_vpc = false), you must provide at least 2 private subnet IDs in different availability zones for existing_subnet_ids."
  }
}

variable "existing_public_subnet_ids" {
  description = "Public subnet IDs in existing VPC (required if create_vpc = false)"
  type        = list(string)
  default     = []

  validation {
    condition     = var.create_vpc || length(var.existing_public_subnet_ids) >= 2
    error_message = "When using existing VPC (create_vpc = false), you must provide at least 2 public subnet IDs in different availability zones for existing_public_subnet_ids."
  }
}

variable "existing_database_subnet_ids" {
  description = "Database subnet IDs in existing VPC (optional - will use private subnets if not provided)"
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.existing_database_subnet_ids) == 0 || length(var.existing_database_subnet_ids) >= 2
    error_message = "When providing existing_database_subnet_ids, you must provide at least 2 subnet IDs in different availability zones."
  }
}

variable "existing_cluster_name" {
  description = "Name of existing EKS cluster (required if create_eks_cluster = false)"
  type        = string
  default     = ""
}

variable "existing_cluster_endpoint" {
  description = "Endpoint of existing EKS cluster (required if create_eks_cluster = false)"
  type        = string
  default     = ""
}

variable "existing_cluster_ca" {
  description = "Certificate authority of existing EKS cluster (required if create_eks_cluster = false)"
  type        = string
  default     = ""
}

variable "existing_oidc_issuer" {
  description = "OIDC issuer URL of existing EKS cluster (required if create_eks_cluster = false)"
  type        = string
  default     = ""
}

variable "existing_database_endpoint" {
  description = "Endpoint of existing PostgreSQL database (required if create_database = false)"
  type        = string
  default     = ""
}

# =============================================================================
# VPC CONFIGURATION
# =============================================================================
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones to use (leave empty for automatic selection)"
  type        = list(string)
  default     = []
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]
}

# =============================================================================
# EKS CONFIGURATION
# =============================================================================
variable "cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "node_groups" {
  description = "EKS node group configurations"
  type = map(object({
    instance_types             = list(string)
    min_size                   = number
    max_size                   = number
    desired_size               = number
    disk_size                  = number
    ami_type                   = optional(string, "AL2_x86_64")
    capacity_type              = optional(string, "ON_DEMAND")
    max_unavailable_percentage = optional(number, 25)
    key_name                   = optional(string, "")
    source_security_group_ids  = optional(list(string), [])
    launch_template_id         = optional(string, "")
    launch_template_version    = optional(string, "$Latest")
    labels                     = optional(map(string), {})
    taints = optional(list(object({
      key    = string
      value  = string
      effect = string
    })), [])
  }))
  default = {
    main = {
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 10
      desired_size   = 3
      disk_size      = 50
    }
  }
}

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
variable "database_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.small"
}

variable "database_allocated_storage" {
  description = "Allocated storage for RDS instance (GB)"
  type        = number
  default     = 100
}

variable "database_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
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
  default     = ["0.0.0.0/0"] # Should be restricted in production
}


# =============================================================================
# BACKUP CONFIGURATION
# =============================================================================
variable "backup_retention_period" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

# =============================================================================
# OPTIONAL FEATURES
# =============================================================================
variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "enable_vpn_gateway" {
  description = "Enable VPN Gateway"
  type        = bool
  default     = false
}

# =============================================================================
# TAGS
# =============================================================================
variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default = {
    Application = "Chartsmith"
    ManagedBy   = "Terraform"
  }
}
