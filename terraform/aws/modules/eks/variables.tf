# =============================================================================
# EKS MODULE VARIABLES
# =============================================================================

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.28"
}

# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================
variable "subnet_ids" {
  description = "List of subnet IDs for the EKS cluster"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs for the EKS cluster"
  type        = list(string)
  default     = []
}

variable "endpoint_private_access" {
  description = "Enable private API server endpoint"
  type        = bool
  default     = true
}

variable "endpoint_public_access" {
  description = "Enable public API server endpoint"
  type        = bool
  default     = true
}

variable "public_access_cidrs" {
  description = "List of CIDR blocks that can access the public API server endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# =============================================================================
# NODE GROUPS CONFIGURATION
# =============================================================================
variable "node_groups" {
  description = "Map of EKS node group configurations"
  type = map(object({
    instance_types                = list(string)
    min_size                     = number
    max_size                     = number
    desired_size                 = number
    disk_size                    = number
    ami_type                     = optional(string, "AL2_x86_64")
    capacity_type                = optional(string, "ON_DEMAND")
    max_unavailable_percentage   = optional(number, 25)
    key_name                     = optional(string, "")
    source_security_group_ids    = optional(list(string), [])
    launch_template_id           = optional(string, "")
    launch_template_version      = optional(string, "$Latest")
    labels                       = optional(map(string), {})
    taints = optional(list(object({
      key    = string
      value  = string
      effect = string
    })), [])
  }))
  default = {
    main = {
      instance_types = ["t3.medium"]
      min_size      = 2
      max_size      = 10
      desired_size  = 3
      disk_size     = 50
    }
  }
}

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
variable "enabled_cluster_log_types" {
  description = "List of control plane logging types to enable"
  type        = list(string)
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

variable "log_retention_days" {
  description = "Number of days to retain cluster logs"
  type        = number
  default     = 14
}

# =============================================================================
# ENCRYPTION CONFIGURATION
# =============================================================================
variable "enable_encryption" {
  description = "Enable envelope encryption for Kubernetes secrets"
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "ARN of existing KMS key for encryption (leave empty to create new)"
  type        = string
  default     = ""
}

variable "kms_key_deletion_window" {
  description = "KMS key deletion window in days"
  type        = number
  default     = 7
}

# =============================================================================
# ADDONS CONFIGURATION
# =============================================================================
variable "enable_vpc_cni_addon" {
  description = "Enable VPC CNI addon"
  type        = bool
  default     = true
}

variable "vpc_cni_addon_version" {
  description = "Version of VPC CNI addon (leave empty for latest)"
  type        = string
  default     = ""
}

variable "vpc_cni_service_account_role_arn" {
  description = "ARN of IAM role for VPC CNI service account"
  type        = string
  default     = ""
}

variable "enable_coredns_addon" {
  description = "Enable CoreDNS addon"
  type        = bool
  default     = true
}

variable "coredns_addon_version" {
  description = "Version of CoreDNS addon (leave empty for latest)"
  type        = string
  default     = ""
}

variable "enable_kube_proxy_addon" {
  description = "Enable kube-proxy addon"
  type        = bool
  default     = true
}

variable "kube_proxy_addon_version" {
  description = "Version of kube-proxy addon (leave empty for latest)"
  type        = string
  default     = ""
}

variable "enable_ebs_csi_addon" {
  description = "Enable EBS CSI driver addon"
  type        = bool
  default     = true
}

variable "ebs_csi_addon_version" {
  description = "Version of EBS CSI driver addon (leave empty for latest)"
  type        = string
  default     = ""
}

variable "ebs_csi_service_account_role_arn" {
  description = "ARN of IAM role for EBS CSI driver service account"
  type        = string
  default     = ""
}

# =============================================================================
# TAGS
# =============================================================================
variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
