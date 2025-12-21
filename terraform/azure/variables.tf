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

variable "azure_region" {
  description = "Azure region for deployment"
  type        = string
  default     = "eastus"
}

variable "resource_group_name" {
  description = "Name of the Azure resource group"
  type        = string
}

# =============================================================================
# INFRASTRUCTURE CHOICES
# =============================================================================
variable "create_vnet" {
  description = "Create a new Virtual Network for Chartsmith"
  type        = bool
  default     = true
}

variable "create_aks_cluster" {
  description = "Create a new AKS cluster for Chartsmith"
  type        = bool
  default     = true
}

variable "create_database" {
  description = "Create a new Azure Database for PostgreSQL for Chartsmith"
  type        = bool
  default     = true
}

# =============================================================================
# EXISTING INFRASTRUCTURE
# =============================================================================
variable "existing_vnet_id" {
  description = "ID of existing Virtual Network (required if create_vnet = false)"
  type        = string
  default     = ""
}

variable "existing_vnet_name" {
  description = "Name of existing Virtual Network (required if create_vnet = false)"
  type        = string
  default     = ""
}

variable "existing_aks_subnet_id" {
  description = "Subnet ID for AKS in existing VNet (required if create_vnet = false)"
  type        = string
  default     = ""
}

variable "existing_database_subnet_id" {
  description = "Subnet ID for database in existing VNet (required if create_vnet = false)"
  type        = string
  default     = ""
}

variable "existing_private_dns_zone_id" {
  description = "Private DNS zone ID for PostgreSQL (required if create_vnet = false)"
  type        = string
  default     = ""
}

variable "existing_cluster_name" {
  description = "Name of existing AKS cluster (required if create_aks_cluster = false)"
  type        = string
  default     = ""
}

variable "existing_database_server" {
  description = "Name of existing PostgreSQL server (required if create_database = false)"
  type        = string
  default     = ""
}

# =============================================================================
# VNET CONFIGURATION
# =============================================================================
variable "vnet_cidr" {
  description = "CIDR block for Virtual Network"
  type        = string
  default     = "10.0.0.0/16"
}

variable "aks_subnet_cidr" {
  description = "CIDR block for AKS subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "database_subnet_cidr" {
  description = "CIDR block for database subnet"
  type        = string
  default     = "10.0.2.0/24"
}

# =============================================================================
# AKS CONFIGURATION
# =============================================================================
variable "kubernetes_version" {
  description = "Kubernetes version for AKS cluster"
  type        = string
  default     = "1.28"
}

variable "default_node_pool" {
  description = "Default node pool configuration"
  type = object({
    name                = string
    vm_size             = string
    node_count          = number
    min_count           = number
    max_count           = number
    enable_auto_scaling = bool
    os_disk_size_gb     = number
  })
  default = {
    name                = "system"
    vm_size             = "Standard_D2s_v3"
    node_count          = 3
    min_count           = 2
    max_count           = 10
    enable_auto_scaling = true
    os_disk_size_gb     = 50
  }
}

variable "node_pools" {
  description = "Additional node pool configurations"
  type = map(object({
    vm_size             = string
    node_count          = number
    min_count           = number
    max_count           = number
    enable_auto_scaling = bool
    os_disk_size_gb     = number
    mode                = optional(string, "User")
    node_labels         = optional(map(string), {})
    node_taints         = optional(list(string), [])
  }))
  default = {}
}

variable "aks_service_cidr" {
  description = "CIDR for Kubernetes services"
  type        = string
  default     = "10.1.0.0/16"
}

variable "aks_dns_service_ip" {
  description = "IP address for Kubernetes DNS service"
  type        = string
  default     = "10.1.0.10"
}

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
variable "database_sku_name" {
  description = "Azure Database for PostgreSQL SKU"
  type        = string
  default     = "B_Standard_B2s"
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "database_storage_mb" {
  description = "Storage size for database (MB)"
  type        = number
  default     = 32768
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
  default     = "chartsmith"
}

variable "database_username" {
  description = "Admin username for database"
  type        = string
  default     = "chartsmith"
}

variable "database_high_availability_mode" {
  description = "High availability mode (ZoneRedundant or SameZone)"
  type        = string
  default     = "Disabled"
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
variable "backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
}

variable "geo_redundant_backup_enabled" {
  description = "Enable geo-redundant backups"
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
