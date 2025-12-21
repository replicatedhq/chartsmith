variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "subnet_cidr" {
  description = "CIDR block for subnet"
  type        = string
}

variable "pods_secondary_range" {
  description = "Secondary IP range for pods"
  type        = string
}

variable "services_secondary_range" {
  description = "Secondary IP range for services"
  type        = string
}

variable "enable_nat_gateway" {
  description = "Enable Cloud NAT"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
