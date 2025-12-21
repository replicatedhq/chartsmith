variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "name_prefix" { type = string }
variable "sku_name" { type = string }
variable "server_version" { type = string }
variable "storage_mb" { type = number }
variable "database_name" { type = string }
variable "admin_username" { type = string }
variable "delegated_subnet_id" { type = string }
variable "private_dns_zone_id" { type = string }
variable "backup_retention_days" { type = number }
variable "geo_redundant_backup_enabled" { type = bool }
variable "high_availability_mode" { type = string }
variable "tags" { type = map(string); default = {} }
