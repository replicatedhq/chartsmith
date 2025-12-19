# =============================================================================
# RDS MODULE VARIABLES
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

# =============================================================================
# BASIC DATABASE CONFIGURATION
# =============================================================================
variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.small"
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 100
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage for autoscaling in GB"
  type        = number
  default     = 1000
}

variable "storage_type" {
  description = "Storage type (gp2, gp3, io1, io2)"
  type        = string
  default     = "gp3"
}

variable "storage_encrypted" {
  description = "Enable storage encryption"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for storage encryption (leave empty for default key)"
  type        = string
  default     = ""
}

# =============================================================================
# DATABASE CREDENTIALS
# =============================================================================
variable "database_name" {
  description = "Name of the database to create"
  type        = string
  default     = "chartsmith"
}

variable "username" {
  description = "Username for the database"
  type        = string
  default     = "chartsmith"
}

variable "port" {
  description = "Database port"
  type        = number
  default     = 5432
}

# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================
variable "subnet_ids" {
  description = "List of subnet IDs for the DB subnet group"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "db_subnet_group_name" {
  description = "Name of existing DB subnet group (leave empty to create new)"
  type        = string
  default     = ""
}

variable "publicly_accessible" {
  description = "Make the database publicly accessible"
  type        = bool
  default     = false
}

# =============================================================================
# BACKUP CONFIGURATION
# =============================================================================
variable "backup_retention_period" {
  description = "Number of days to retain backups"
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

variable "delete_automated_backups" {
  description = "Delete automated backups when the DB instance is deleted"
  type        = bool
  default     = true
}

# =============================================================================
# MONITORING AND LOGGING
# =============================================================================
variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds (0, 1, 5, 10, 15, 30, 60)"
  type        = number
  default     = 60

  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be one of: 0, 1, 5, 10, 15, 30, 60."
  }
}

variable "enabled_cloudwatch_logs_exports" {
  description = "List of log types to export to CloudWatch"
  type        = list(string)
  default     = ["postgresql", "upgrade"]
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7

  validation {
    condition     = contains([7, 31, 62, 93, 124, 155, 186, 217, 248, 279, 310, 341, 372, 403, 434, 465, 496, 527, 558, 589, 620, 651, 682, 713, 731], var.performance_insights_retention_period)
    error_message = "Performance Insights retention period must be a valid value."
  }
}

variable "create_cloudwatch_alarms" {
  description = "Create CloudWatch alarms for the database"
  type        = bool
  default     = true
}

# =============================================================================
# PERFORMANCE TUNING
# =============================================================================
variable "max_connections" {
  description = "Maximum number of connections"
  type        = string
  default     = "100"
}

variable "enable_query_logging" {
  description = "Enable query logging (can impact performance)"
  type        = bool
  default     = false
}

variable "slow_query_threshold_ms" {
  description = "Log queries slower than this threshold (milliseconds)"
  type        = string
  default     = "1000"
}

# =============================================================================
# HIGH AVAILABILITY
# =============================================================================
variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false
}

variable "create_read_replica" {
  description = "Create a read replica"
  type        = bool
  default     = false
}

variable "read_replica_instance_class" {
  description = "Instance class for read replica (leave empty to use same as primary)"
  type        = string
  default     = ""
}

# =============================================================================
# MAINTENANCE AND UPDATES
# =============================================================================
variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

variable "apply_immediately" {
  description = "Apply changes immediately (use with caution in production)"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when deleting"
  type        = bool
  default     = false
}

# =============================================================================
# TAGS
# =============================================================================
variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
