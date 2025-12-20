# =============================================================================
# CHARTSMITH AWS DEPLOYMENT
# Complete AWS infrastructure for self-hosted Chartsmith
# =============================================================================

locals {
  name_prefix = "chartsmith-${var.environment_name}"

  common_tags = merge(var.tags, {
    Application   = "Chartsmith"
    Environment   = var.environment_name
    ManagedBy     = "Terraform"
    CloudProvider = "AWS"
  })

  # Determine which subnets to use based on whether VPC is created or existing
  vpc_id             = var.create_vpc ? module.vpc[0].vpc_id : var.existing_vpc_id
  private_subnet_ids = var.create_vpc ? module.vpc[0].private_subnet_ids : var.existing_subnet_ids
  public_subnet_ids  = var.create_vpc ? module.vpc[0].public_subnet_ids : var.existing_public_subnet_ids

  # Database subnet fallback logic: use dedicated database subnets if provided, otherwise fall back to private subnets
  database_subnet_ids = var.create_vpc ? module.vpc[0].database_subnet_ids : (
    length(var.existing_database_subnet_ids) > 0 ? var.existing_database_subnet_ids : var.existing_subnet_ids
  )

  database_subnet_group_name = var.create_vpc ? module.vpc[0].database_subnet_group_name : ""
}

# =============================================================================
# VALIDATION CHECKS
# =============================================================================
resource "terraform_data" "validate_existing_vpc_config" {
  count = var.create_vpc ? 0 : 1

  lifecycle {
    precondition {
      condition     = var.existing_vpc_id != ""
      error_message = "When using existing VPC (create_vpc = false), you must provide existing_vpc_id."
    }

    precondition {
      condition     = length(var.existing_subnet_ids) >= 2
      error_message = "When using existing VPC (create_vpc = false), you must provide at least 2 private subnet IDs in different availability zones for existing_subnet_ids."
    }

    precondition {
      condition     = length(var.existing_public_subnet_ids) >= 2
      error_message = "When using existing VPC (create_vpc = false), you must provide at least 2 public subnet IDs in different availability zones for existing_public_subnet_ids."
    }
  }
}

# =============================================================================
# VPC MODULE
# =============================================================================
module "vpc" {
  count  = var.create_vpc ? 1 : 0
  source = "./modules/vpc"

  name_prefix = local.name_prefix

  vpc_cidr              = var.vpc_cidr
  availability_zones    = var.availability_zones
  private_subnet_cidrs  = var.private_subnet_cidrs
  public_subnet_cidrs   = var.public_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs

  enable_nat_gateway   = var.enable_nat_gateway
  enable_vpn_gateway   = var.enable_vpn_gateway
  enable_vpc_endpoints = var.create_vpc ? true : false # Enable VPC endpoints when creating VPC

  tags = local.common_tags
}

# =============================================================================
# SECURITY GROUPS MODULE
# =============================================================================
module "security_groups" {
  source = "./modules/security-groups"

  name_prefix = local.name_prefix
  vpc_id      = local.vpc_id

  allowed_cidr_blocks            = var.allowed_cidr_blocks
  enable_bastion                 = false # Can be made configurable later
  enable_vpc_endpoints           = var.create_vpc ? true : false
  allow_external_database_access = false # Keep database private

  tags = local.common_tags

  depends_on = [module.vpc]
}

# =============================================================================
# DATABASE CREDENTIALS SECRET (Infrastructure only)
# =============================================================================
resource "aws_secretsmanager_secret" "database_credentials" {
  count = var.create_database ? 1 : 0

  name        = "${local.name_prefix}-database-credentials"
  description = "Database connection credentials for Chartsmith"

  tags = merge(local.common_tags, {
    Name      = "${local.name_prefix}-database-credentials"
    Type      = "secret"
    Component = "database"
  })
}

resource "aws_secretsmanager_secret_version" "database_credentials" {
  count = var.create_database ? 1 : 0

  secret_id = aws_secretsmanager_secret.database_credentials[0].id
  secret_string = jsonencode({
    endpoint          = module.rds[0].endpoint
    port              = module.rds[0].port
    database          = module.rds[0].database_name
    username          = module.rds[0].username
    password          = module.rds[0].password
    connection_string = module.rds[0].connection_string
  })

  depends_on = [module.rds]
}

# =============================================================================
# RDS POSTGRESQL MODULE
# =============================================================================
module "rds" {
  count  = var.create_database ? 1 : 0
  source = "./modules/rds"

  name_prefix = local.name_prefix

  # Instance configuration
  instance_class    = var.database_instance_class
  engine_version    = var.database_engine_version
  allocated_storage = var.database_allocated_storage
  storage_encrypted = true

  # Database configuration
  database_name = var.database_name
  username      = var.database_username

  # Network configuration
  subnet_ids           = local.database_subnet_ids
  security_group_ids   = [module.security_groups.rds_security_group_id]
  db_subnet_group_name = local.database_subnet_group_name
  publicly_accessible  = false # Keep database private

  # Backup configuration
  backup_retention_period = var.backup_retention_period
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window

  # Performance and monitoring
  monitoring_interval          = 60
  performance_insights_enabled = true
  create_cloudwatch_alarms     = true

  # High availability (can be enabled for production)
  multi_az = false # Can be made configurable

  # Security
  deletion_protection = true
  skip_final_snapshot = false

  tags = local.common_tags

  depends_on = [module.vpc, module.security_groups]
}

# =============================================================================
# IAM ROLES MODULE (Placeholder - will implement next)
# =============================================================================
# module "iam" {
#   source = "./modules/iam"
#
#   name_prefix = local.name_prefix
#
#   # EKS cluster info for IRSA
#   cluster_name = var.create_eks_cluster ? module.eks[0].cluster_name : var.existing_cluster_name
#   oidc_issuer  = var.create_eks_cluster ? module.eks[0].oidc_issuer : var.existing_oidc_issuer
#
#   # Secrets Manager ARNs for access
#   secrets_arns = module.secrets.secrets_arns
#
#   tags = local.common_tags
#
#   depends_on = [module.eks, module.secrets]
# }

# =============================================================================
# EKS CLUSTER MODULE
# =============================================================================
module "eks" {
  count  = var.create_eks_cluster ? 1 : 0
  source = "./modules/eks"

  cluster_name    = "${local.name_prefix}-eks"
  cluster_version = var.cluster_version

  subnet_ids = local.private_subnet_ids

  security_group_ids = [
    module.security_groups.eks_cluster_security_group_id,
    module.security_groups.eks_nodes_security_group_id
  ]

  # Node groups configuration
  node_groups = var.node_groups

  # Logging configuration
  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  log_retention_days        = 14

  # Encryption
  enable_encryption = true

  # Addons
  enable_vpc_cni_addon    = true
  enable_coredns_addon    = true
  enable_kube_proxy_addon = true
  enable_ebs_csi_addon    = true

  tags = local.common_tags

  depends_on = [module.vpc, module.security_groups]
}


