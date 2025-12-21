# =============================================================================
# SECURITY GROUPS MODULE OUTPUTS
# =============================================================================

output "eks_cluster_security_group_id" {
  description = "ID of the EKS cluster security group"
  value       = aws_security_group.eks_cluster.id
}

output "eks_nodes_security_group_id" {
  description = "ID of the EKS worker nodes security group"
  value       = aws_security_group.eks_nodes.id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}


output "bastion_security_group_id" {
  description = "ID of the bastion host security group"
  value       = var.enable_bastion ? aws_security_group.bastion[0].id : null
}

output "vpc_endpoints_security_group_id" {
  description = "ID of the VPC endpoints security group"
  value       = var.enable_vpc_endpoints ? aws_security_group.vpc_endpoints[0].id : null
}

# =============================================================================
# SECURITY GROUP ARNS (for reference)
# =============================================================================

output "eks_cluster_security_group_arn" {
  description = "ARN of the EKS cluster security group"
  value       = aws_security_group.eks_cluster.arn
}

output "eks_nodes_security_group_arn" {
  description = "ARN of the EKS worker nodes security group"
  value       = aws_security_group.eks_nodes.arn
}

output "rds_security_group_arn" {
  description = "ARN of the RDS security group"
  value       = aws_security_group.rds.arn
}

