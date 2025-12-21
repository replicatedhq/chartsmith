# =============================================================================
# EKS MODULE OUTPUTS
# =============================================================================

# =============================================================================
# CLUSTER INFORMATION
# =============================================================================
output "cluster_id" {
  description = "EKS cluster ID"
  value       = aws_eks_cluster.main.id
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "cluster_arn" {
  description = "EKS cluster ARN"
  value       = aws_eks_cluster.main.arn
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_version" {
  description = "EKS cluster Kubernetes version"
  value       = aws_eks_cluster.main.version
}

output "cluster_platform_version" {
  description = "EKS cluster platform version"
  value       = aws_eks_cluster.main.platform_version
}

output "cluster_status" {
  description = "EKS cluster status"
  value       = aws_eks_cluster.main.status
}

# =============================================================================
# CLUSTER SECURITY
# =============================================================================
output "cluster_security_group_id" {
  description = "EKS cluster security group ID"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

# =============================================================================
# OIDC PROVIDER (for IRSA)
# =============================================================================
output "oidc_issuer_url" {
  description = "The URL on the EKS cluster OIDC Issuer"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "oidc_provider_arn" {
  description = "ARN of the OIDC Provider for IRSA"
  value       = aws_iam_openid_connect_provider.cluster.arn
}

# =============================================================================
# NODE GROUPS INFORMATION
# =============================================================================
output "node_groups" {
  description = "Map of node group information"
  value = {
    for k, v in aws_eks_node_group.main : k => {
      arn           = v.arn
      status        = v.status
      capacity_type = v.capacity_type
      instance_types = v.instance_types
      ami_type      = v.ami_type
      disk_size     = v.disk_size
      scaling_config = v.scaling_config
    }
  }
}

output "node_group_arns" {
  description = "List of node group ARNs"
  value       = [for ng in aws_eks_node_group.main : ng.arn]
}

output "node_group_status" {
  description = "Status of node groups"
  value       = { for k, v in aws_eks_node_group.main : k => v.status }
}

# =============================================================================
# IAM ROLES
# =============================================================================
output "cluster_iam_role_arn" {
  description = "IAM role ARN of the EKS cluster"
  value       = aws_iam_role.cluster.arn
}

output "cluster_iam_role_name" {
  description = "IAM role name of the EKS cluster"
  value       = aws_iam_role.cluster.name
}

output "node_group_iam_role_arn" {
  description = "IAM role ARN of the EKS node groups"
  value       = aws_iam_role.node_group.arn
}

output "node_group_iam_role_name" {
  description = "IAM role name of the EKS node groups"
  value       = aws_iam_role.node_group.name
}

# =============================================================================
# ENCRYPTION
# =============================================================================
output "kms_key_arn" {
  description = "ARN of the KMS key used for encryption"
  value       = var.enable_encryption ? (var.kms_key_arn != "" ? var.kms_key_arn : aws_kms_key.eks[0].arn) : null
}

output "kms_key_id" {
  description = "ID of the KMS key used for encryption"
  value       = var.enable_encryption && var.kms_key_arn == "" ? aws_kms_key.eks[0].key_id : null
}

# =============================================================================
# LOGGING
# =============================================================================
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for cluster logs"
  value       = aws_cloudwatch_log_group.cluster.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group for cluster logs"
  value       = aws_cloudwatch_log_group.cluster.arn
}

# =============================================================================
# KUBECTL CONFIGURATION
# =============================================================================
output "kubectl_config" {
  description = "kubectl configuration command"
  value       = "aws eks update-kubeconfig --region ${data.aws_region.current.name} --name ${aws_eks_cluster.main.name}"
}

# =============================================================================
# ADDONS INFORMATION
# =============================================================================
output "addons" {
  description = "Information about enabled addons"
  value = {
    vpc_cni_enabled    = var.enable_vpc_cni_addon
    coredns_enabled    = var.enable_coredns_addon
    kube_proxy_enabled = var.enable_kube_proxy_addon
    ebs_csi_enabled    = var.enable_ebs_csi_addon
  }
}
