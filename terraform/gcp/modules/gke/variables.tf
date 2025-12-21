variable "project_id" { type = string }
variable "cluster_name" { type = string }
variable "region" { type = string }
variable "network_name" { type = string }
variable "subnet_name" { type = string }
variable "pods_secondary_range_name" { type = string }
variable "services_secondary_range_name" { type = string }
variable "kubernetes_version" { type = string }
variable "logging_service" { type = string }
variable "monitoring_service" { type = string }
variable "enable_workload_identity" { type = bool; default = true }
variable "enable_shielded_nodes" { type = bool; default = true }
variable "node_pools" { type = any }
variable "labels" { type = map(string); default = {} }
