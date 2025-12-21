# =============================================================================
# RDS MODULE
# Creates PostgreSQL database with pgvector extension for Chartsmith
# =============================================================================

# Generate random password for database
resource "random_password" "database_password" {
  length  = 32
  special = true
  # Exclude characters that might cause issues in connection strings
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# =============================================================================
# RDS PARAMETER GROUP (for pgvector and performance tuning)
# =============================================================================
resource "aws_db_parameter_group" "main" {
  family = "postgres15"
  name   = "${var.name_prefix}-postgres-params"

  # Enable pgvector extension
  parameter {
    name  = "shared_preload_libraries"
    value = "vector"
  }

  # Performance tuning parameters
  parameter {
    name  = "max_connections"
    value = var.max_connections
  }

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4}"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4}"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "2048000"  # 2GB in KB
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  parameter {
    name  = "wal_buffers"
    value = "16384"  # 16MB in KB
  }

  parameter {
    name  = "default_statistics_target"
    value = "100"
  }

  parameter {
    name  = "random_page_cost"
    value = "1.1"  # Optimized for SSD
  }

  parameter {
    name  = "effective_io_concurrency"
    value = "200"  # Optimized for SSD
  }

  # Logging parameters
  parameter {
    name  = "log_statement"
    value = var.enable_query_logging ? "all" : "none"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = var.slow_query_threshold_ms
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres-params"
    Type = "db-parameter-group"
  })
}

# =============================================================================
# RDS OPTION GROUP (for extensions)
# =============================================================================
resource "aws_db_option_group" "main" {
  name                     = "${var.name_prefix}-postgres-options"
  option_group_description = "Option group for Chartsmith PostgreSQL with pgvector"
  engine_name              = "postgres"
  major_engine_version     = split(".", var.engine_version)[0]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres-options"
    Type = "db-option-group"
  })
}

# =============================================================================
# RDS SUBNET GROUP
# =============================================================================
resource "aws_db_subnet_group" "main" {
  count = var.db_subnet_group_name == "" ? 1 : 0

  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-subnet-group"
    Type = "db-subnet-group"
  })
}

# =============================================================================
# RDS INSTANCE
# =============================================================================
resource "aws_db_instance" "main" {
  # Basic configuration
  identifier = "${var.name_prefix}-postgres"

  # Engine configuration
  engine                      = "postgres"
  engine_version             = var.engine_version
  instance_class             = var.instance_class
  allocated_storage          = var.allocated_storage
  max_allocated_storage      = var.max_allocated_storage
  storage_type               = var.storage_type
  storage_encrypted          = var.storage_encrypted
  kms_key_id                = var.kms_key_id

  # Database configuration
  db_name  = var.database_name
  username = var.username
  password = random_password.database_password.result
  port     = var.port

  # Parameter and option groups
  parameter_group_name = aws_db_parameter_group.main.name
  option_group_name    = aws_db_option_group.main.name

  # Network configuration
  db_subnet_group_name   = var.db_subnet_group_name != "" ? var.db_subnet_group_name : aws_db_subnet_group.main[0].name
  vpc_security_group_ids = var.security_group_ids
  publicly_accessible    = var.publicly_accessible

  # Backup configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window
  copy_tags_to_snapshot  = true
  delete_automated_backups = var.delete_automated_backups

  # Monitoring and logging
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null

  enabled_cloudwatch_logs_exports = var.enabled_cloudwatch_logs_exports
  performance_insights_enabled    = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? var.performance_insights_retention_period : null

  # Deletion protection
  deletion_protection = var.deletion_protection
  skip_final_snapshot = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name_prefix}-postgres-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # Multi-AZ and read replicas
  multi_az = var.multi_az

  # Auto minor version upgrade
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  # Apply changes immediately (use with caution in production)
  apply_immediately = var.apply_immediately

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres"
    Type = "rds-instance"
    Engine = "postgres"
  })

  depends_on = [
    aws_db_parameter_group.main,
    aws_db_option_group.main
  ]
}

# =============================================================================
# IAM ROLE FOR RDS ENHANCED MONITORING
# =============================================================================
resource "aws_iam_role" "rds_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0

  name = "${var.name_prefix}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rds-monitoring-role"
    Type = "iam-role"
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0

  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# =============================================================================
# READ REPLICA (OPTIONAL)
# =============================================================================
resource "aws_db_instance" "read_replica" {
  count = var.create_read_replica ? 1 : 0

  identifier = "${var.name_prefix}-postgres-replica"

  # Replica configuration
  replicate_source_db = aws_db_instance.main.identifier

  # Instance configuration (can be different from primary)
  instance_class = var.read_replica_instance_class != "" ? var.read_replica_instance_class : var.instance_class

  # Network configuration
  publicly_accessible = var.publicly_accessible

  # Monitoring
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null

  performance_insights_enabled = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? var.performance_insights_retention_period : null

  # Auto minor version upgrade
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres-replica"
    Type = "rds-read-replica"
    Engine = "postgres"
  })
}

# =============================================================================
# CLOUDWATCH ALARMS (OPTIONAL)
# =============================================================================
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-rds-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rds-cpu-alarm"
    Type = "cloudwatch-alarm"
  })
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-rds-connection-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.max_connections * 0.8  # Alert at 80% of max connections
  alarm_description   = "This metric monitors RDS connection count"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rds-connections-alarm"
    Type = "cloudwatch-alarm"
  })
}
