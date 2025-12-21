variable "project_id" { type = string }
variable "name_prefix" { type = string }
variable "region" { type = string }
variable "tier" { type = string }
variable "database_version" { type = string }
variable "availability_type" { type = string }
variable "disk_size" { type = number }
variable "disk_autoresize" { type = bool }
variable "disk_autoresize_limit" { type = number }
variable "database_name" { type = string }
variable "username" { type = string }
variable "network_id" { type = string }
variable "private_network" { type = string }
variable "backup_enabled" { type = bool }
variable "backup_start_time" { type = string }
variable "point_in_time_recovery_enabled" { type = bool }
variable "deletion_protection" { type = bool }
variable "labels" { type = map(string); default = {} }
