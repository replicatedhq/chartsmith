variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "name_prefix" { type = string }
variable "allowed_cidr_blocks" { type = list(string) }
variable "tags" { type = map(string); default = {} }
