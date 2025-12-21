# =============================================================================
# RDS MODULE OUTPUTS
# =============================================================================

# =============================================================================
# DATABASE CONNECTION INFORMATION
# =============================================================================
output "endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "Name of the database"
  value       = aws_db_instance.main.db_name
}

output "username" {
  description = "Database username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "password" {
  description = "Database password"
  value       = random_password.database_password.result
  sensitive   = true
}

# =============================================================================
# CONNECTION STRING
# =============================================================================
output "connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgres://${aws_db_instance.main.username}:${random_password.database_password.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}?sslmode=require"
  sensitive   = true
}

output "connection_string_without_credentials" {
  description = "PostgreSQL connection string without credentials"
  value       = "postgres://USERNAME:PASSWORD@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}?sslmode=require"
}

# =============================================================================
# DATABASE INSTANCE INFORMATION
# =============================================================================
output "instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.main.id
}

output "instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}

output "instance_class" {
  description = "RDS instance class"
  value       = aws_db_instance.main.instance_class
}

output "engine_version" {
  description = "Database engine version"
  value       = aws_db_instance.main.engine_version
}

output "allocated_storage" {
  description = "Allocated storage in GB"
  value       = aws_db_instance.main.allocated_storage
}

# =============================================================================
# NETWORK INFORMATION
# =============================================================================
output "hosted_zone_id" {
  description = "Hosted zone ID of the DB instance"
  value       = aws_db_instance.main.hosted_zone_id
}

output "vpc_security_group_ids" {
  description = "VPC security group IDs"
  value       = aws_db_instance.main.vpc_security_group_ids
}

output "db_subnet_group_name" {
  description = "DB subnet group name"
  value       = aws_db_instance.main.db_subnet_group_name
}

# =============================================================================
# BACKUP INFORMATION
# =============================================================================
output "backup_retention_period" {
  description = "Backup retention period"
  value       = aws_db_instance.main.backup_retention_period
}

output "backup_window" {
  description = "Backup window"
  value       = aws_db_instance.main.backup_window
}

output "maintenance_window" {
  description = "Maintenance window"
  value       = aws_db_instance.main.maintenance_window
}

# =============================================================================
# READ REPLICA INFORMATION
# =============================================================================
output "read_replica_endpoint" {
  description = "Read replica endpoint"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].endpoint : null
}

output "read_replica_id" {
  description = "Read replica instance ID"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].id : null
}

# =============================================================================
# PARAMETER AND OPTION GROUPS
# =============================================================================
output "parameter_group_name" {
  description = "DB parameter group name"
  value       = aws_db_parameter_group.main.name
}

output "option_group_name" {
  description = "DB option group name"
  value       = aws_db_option_group.main.name
}

# =============================================================================
# MONITORING
# =============================================================================
output "monitoring_role_arn" {
  description = "Enhanced monitoring IAM role ARN"
  value       = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null
}

output "performance_insights_enabled" {
  description = "Whether Performance Insights is enabled"
  value       = aws_db_instance.main.performance_insights_enabled
}

# =============================================================================
# CLOUDWATCH ALARMS
# =============================================================================
output "cpu_alarm_arn" {
  description = "CPU utilization alarm ARN"
  value       = var.create_cloudwatch_alarms ? aws_cloudwatch_metric_alarm.database_cpu[0].arn : null
}

output "connections_alarm_arn" {
  description = "Database connections alarm ARN"
  value       = var.create_cloudwatch_alarms ? aws_cloudwatch_metric_alarm.database_connections[0].arn : null
}

# =============================================================================
# CREDENTIALS FOR SECRETS MANAGER
# =============================================================================
output "database_credentials" {
  description = "Database credentials object for Secrets Manager"
  value = {
    endpoint = aws_db_instance.main.endpoint
    port     = aws_db_instance.main.port
    database = aws_db_instance.main.db_name
    username = aws_db_instance.main.username
    password = random_password.database_password.result
  }
  sensitive = true
}

