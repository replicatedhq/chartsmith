variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "cluster_name" { type = string }
variable "kubernetes_version" { type = string }
variable "vnet_subnet_id" { type = string }
variable "default_node_pool" { type = any }
variable "node_pools" { type = any }
variable "identity_type" { type = string }
variable "network_plugin" { type = string }
variable "network_policy" { type = string }
variable "load_balancer_sku" { type = string }
variable "dns_service_ip" { type = string }
variable "service_cidr" { type = string }
variable "log_analytics_workspace_enabled" { type = bool }
variable "tags" { type = map(string); default = {} }
