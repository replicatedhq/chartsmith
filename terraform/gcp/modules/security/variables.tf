variable "project_id" { type = string }
variable "network_name" { type = string }
variable "name_prefix" { type = string }
variable "allowed_cidr_blocks" { type = list(string) }
variable "labels" { type = map(string); default = {} }
