# =============================================================================
# AWS DEPLOYMENT OUTPUTS
# Information customers get after successful deployment
# =============================================================================

# =============================================================================
# DEPLOYMENT INFORMATION
# =============================================================================
output "deployment_info" {
  description = "Summary of deployment information"
  value = {
    environment_name = var.environment_name
    aws_region       = var.aws_region
    vpc_created      = var.create_vpc
    eks_created      = var.create_eks_cluster
    database_created = var.create_database
    cluster_name     = var.create_eks_cluster ? module.eks[0].cluster_name : var.existing_cluster_name
  }
}

# =============================================================================
# NETWORK INFORMATION
# =============================================================================
output "vpc_info" {
  description = "VPC information"
  value = var.create_vpc ? {
    vpc_id              = module.vpc[0].vpc_id
    vpc_cidr            = module.vpc[0].vpc_cidr_block
    public_subnet_ids   = module.vpc[0].public_subnet_ids
    private_subnet_ids  = module.vpc[0].private_subnet_ids
    database_subnet_ids = module.vpc[0].database_subnet_ids
    availability_zones  = module.vpc[0].availability_zones
    nat_gateway_ips     = module.vpc[0].nat_gateway_public_ips
    } : {
    vpc_id  = var.existing_vpc_id
    message = "Using existing VPC"
  }
}

# =============================================================================
# DATABASE INFORMATION
# =============================================================================
output "database_info" {
  description = "Database connection information"
  value = var.create_database ? {
    endpoint         = module.rds[0].endpoint
    port             = module.rds[0].port
    database_name    = module.rds[0].database_name
    instance_class   = module.rds[0].instance_class
    engine_version   = module.rds[0].engine_version
    backup_retention = module.rds[0].backup_retention_period
    multi_az         = false # Will be configurable later
    encrypted        = true
    } : {
    endpoint = var.existing_database_endpoint
    message  = "Using existing database"
  }
  sensitive = true
}

# =============================================================================
# EKS CLUSTER INFORMATION
# =============================================================================
output "eks_info" {
  description = "EKS cluster information"
  value = var.create_eks_cluster ? {
    cluster_name     = module.eks[0].cluster_name
    cluster_endpoint = module.eks[0].cluster_endpoint
    cluster_version  = module.eks[0].cluster_version
    cluster_status   = module.eks[0].cluster_status
    oidc_issuer_url  = module.eks[0].oidc_issuer_url
    node_groups      = keys(var.node_groups)
    kubectl_config   = module.eks[0].kubectl_config
    } : {
    cluster_name = var.existing_cluster_name
    message      = "Using existing EKS cluster"
  }
}

# =============================================================================
# SECRETS INFORMATION
# =============================================================================
output "secrets_info" {
  description = "Information about created secrets"
  value = {
    secrets_created = var.create_database ? ["database-credentials"] : []
    secrets_region  = var.aws_region
  }
}

# =============================================================================
# SECURITY GROUPS
# =============================================================================
output "security_groups" {
  description = "Security group information"
  value = {
    eks_cluster_sg = module.security_groups.eks_cluster_security_group_id
    eks_nodes_sg   = module.security_groups.eks_nodes_security_group_id
    rds_sg         = module.security_groups.rds_security_group_id
  }
}

# =============================================================================
# NEXT STEPS FOR CUSTOMER
# =============================================================================
output "next_steps" {
  description = "What to do after deployment"
  value       = <<-EOT
    ✅ Chartsmith AWS infrastructure deployed successfully!

    📋 What was created:
    ${var.create_vpc ? "- VPC with public, private, and database subnets" : "- Used existing VPC"}
    ${var.create_eks_cluster ? "- EKS cluster with managed node groups" : "- Configured for existing EKS cluster"}
    ${var.create_database ? "- PostgreSQL database with pgvector extension" : "- Configured for existing database"}
    - Security groups for EKS cluster and RDS database
    ${var.create_database ? "- Database credentials in AWS Secrets Manager" : ""}

    🚧 Still needed (coming in next modules):
    - IAM roles for service accounts (IRSA)

    📚 Resources:
    - VPC ID: ${local.vpc_id}
    ${var.create_eks_cluster ? "- EKS Cluster: ${module.eks[0].cluster_name}" : "- EKS Cluster: ${var.existing_cluster_name} (existing)"}
    - Database: ${var.create_database ? module.rds[0].endpoint : var.existing_database_endpoint}
    ${var.create_database ? "- Database credentials: AWS Secrets Manager in ${var.aws_region}" : ""}

    🔧 Manual steps required:
    1. Configure kubectl access: ${var.create_eks_cluster ? module.eks[0].kubectl_config : "aws eks update-kubeconfig --name ${var.existing_cluster_name}"}
    2. Deploy Chartsmith via Helm
    3. Verify database connectivity and pgvector extension

  EOT
}

# =============================================================================
# TERRAFORM STATE INFORMATION
# =============================================================================
output "terraform_info" {
  description = "Terraform state information"
  value = {
    terraform_version    = "~> 1.0"
    aws_provider_version = "~> 5.0"
    region               = var.aws_region
    state_backend        = "Configure remote state backend for production use"
  }
}


# =============================================================================
# SENSITIVE OUTPUTS (for automation)
# =============================================================================
output "database_connection_string" {
  description = "Database connection string"
  value       = var.create_database ? module.rds[0].connection_string : "Configure manually for existing database"
  sensitive   = true
}

output "database_secret_arn" {
  description = "ARN of database credentials secret"
  value       = var.create_database ? aws_secretsmanager_secret.database_credentials[0].arn : null
  sensitive   = true
}

