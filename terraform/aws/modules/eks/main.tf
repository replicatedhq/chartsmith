# =============================================================================
# EKS MODULE
# Creates EKS cluster with managed node groups and IRSA support
# =============================================================================

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# =============================================================================
# EKS CLUSTER
# =============================================================================
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  version  = var.cluster_version
  role_arn = aws_iam_role.cluster.arn

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = var.endpoint_private_access
    endpoint_public_access  = var.endpoint_public_access
    public_access_cidrs     = var.public_access_cidrs
    security_group_ids      = var.security_group_ids
  }

  # Enable EKS cluster logging
  enabled_cluster_log_types = var.enabled_cluster_log_types

  # Encryption configuration
  dynamic "encryption_config" {
    for_each = var.enable_encryption ? [1] : []
    content {
      provider {
        key_arn = var.kms_key_arn != "" ? var.kms_key_arn : aws_kms_key.eks[0].arn
      }
      resources = ["secrets"]
    }
  }

  tags = merge(var.tags, {
    Name = var.cluster_name
    Type = "eks-cluster"
  })

  depends_on = [
    aws_iam_role_policy_attachment.cluster_AmazonEKSClusterPolicy,
    aws_iam_role_policy_attachment.cluster_AmazonEKSVPCResourceController,
    aws_cloudwatch_log_group.cluster
  ]
}

# =============================================================================
# KMS KEY FOR EKS ENCRYPTION
# =============================================================================
resource "aws_kms_key" "eks" {
  count = var.enable_encryption && var.kms_key_arn == "" ? 1 : 0

  description             = "EKS encryption key for ${var.cluster_name}"
  deletion_window_in_days = var.kms_key_deletion_window

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-eks-encryption-key"
    Type = "kms-key"
  })
}

resource "aws_kms_alias" "eks" {
  count = var.enable_encryption && var.kms_key_arn == "" ? 1 : 0

  name          = "alias/${var.cluster_name}-eks-encryption"
  target_key_id = aws_kms_key.eks[0].key_id
}

# =============================================================================
# CLOUDWATCH LOG GROUP FOR EKS CLUSTER LOGS
# =============================================================================
resource "aws_cloudwatch_log_group" "cluster" {
  name              = "/aws/eks/${var.cluster_name}/cluster"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.enable_encryption && var.kms_key_arn == "" ? aws_kms_key.eks[0].arn : var.kms_key_arn

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-cluster-logs"
    Type = "cloudwatch-log-group"
  })
}

# =============================================================================
# EKS CLUSTER IAM ROLE
# =============================================================================
resource "aws_iam_role" "cluster" {
  name = "${var.cluster_name}-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-cluster-role"
    Type = "iam-role"
  })
}

resource "aws_iam_role_policy_attachment" "cluster_AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster.name
}

resource "aws_iam_role_policy_attachment" "cluster_AmazonEKSVPCResourceController" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
  role       = aws_iam_role.cluster.name
}

# =============================================================================
# EKS NODE GROUP IAM ROLE
# =============================================================================
resource "aws_iam_role" "node_group" {
  name = "${var.cluster_name}-node-group-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-node-group-role"
    Type = "iam-role"
  })
}

resource "aws_iam_role_policy_attachment" "node_group_AmazonEKSWorkerNodePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.node_group.name
}

resource "aws_iam_role_policy_attachment" "node_group_AmazonEKS_CNI_Policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.node_group.name
}

resource "aws_iam_role_policy_attachment" "node_group_AmazonEC2ContainerRegistryReadOnly" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.node_group.name
}

# =============================================================================
# EKS MANAGED NODE GROUPS
# =============================================================================
resource "aws_eks_node_group" "main" {
  for_each = var.node_groups

  cluster_name    = aws_eks_cluster.main.name
  node_group_name = each.key
  node_role_arn   = aws_iam_role.node_group.arn
  subnet_ids      = var.subnet_ids

  # Instance configuration
  instance_types = each.value.instance_types
  disk_size      = each.value.disk_size
  ami_type       = each.value.ami_type
  capacity_type  = each.value.capacity_type

  # Scaling configuration
  scaling_config {
    desired_size = each.value.desired_size
    max_size     = each.value.max_size
    min_size     = each.value.min_size
  }

  # Update configuration
  update_config {
    max_unavailable_percentage = each.value.max_unavailable_percentage
  }

  # Remote access configuration (optional)
  dynamic "remote_access" {
    for_each = each.value.key_name != "" ? [1] : []
    content {
      ec2_ssh_key               = each.value.key_name
      source_security_group_ids = each.value.source_security_group_ids
    }
  }

  # Launch template (optional)
  dynamic "launch_template" {
    for_each = each.value.launch_template_id != "" ? [1] : []
    content {
      id      = each.value.launch_template_id
      version = each.value.launch_template_version
    }
  }

  # Taints (optional)
  dynamic "taint" {
    for_each = each.value.taints
    content {
      key    = taint.value.key
      value  = taint.value.value
      effect = taint.value.effect
    }
  }

  # Labels
  labels = merge(each.value.labels, {
    "node-group" = each.key
  })

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-${each.key}-node-group"
    Type = "eks-node-group"
    NodeGroup = each.key
  })

  depends_on = [
    aws_iam_role_policy_attachment.node_group_AmazonEKSWorkerNodePolicy,
    aws_iam_role_policy_attachment.node_group_AmazonEKS_CNI_Policy,
    aws_iam_role_policy_attachment.node_group_AmazonEC2ContainerRegistryReadOnly,
  ]
}

# =============================================================================
# EKS ADDONS
# =============================================================================
resource "aws_eks_addon" "vpc_cni" {
  count = var.enable_vpc_cni_addon ? 1 : 0

  cluster_name             = aws_eks_cluster.main.name
  addon_name               = "vpc-cni"
  addon_version            = var.vpc_cni_addon_version
  resolve_conflicts        = "OVERWRITE"
  service_account_role_arn = var.vpc_cni_service_account_role_arn

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-vpc-cni-addon"
    Type = "eks-addon"
  })

  depends_on = [aws_eks_node_group.main]
}

resource "aws_eks_addon" "coredns" {
  count = var.enable_coredns_addon ? 1 : 0

  cluster_name      = aws_eks_cluster.main.name
  addon_name        = "coredns"
  addon_version     = var.coredns_addon_version
  resolve_conflicts = "OVERWRITE"

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-coredns-addon"
    Type = "eks-addon"
  })

  depends_on = [aws_eks_node_group.main]
}

resource "aws_eks_addon" "kube_proxy" {
  count = var.enable_kube_proxy_addon ? 1 : 0

  cluster_name      = aws_eks_cluster.main.name
  addon_name        = "kube-proxy"
  addon_version     = var.kube_proxy_addon_version
  resolve_conflicts = "OVERWRITE"

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-kube-proxy-addon"
    Type = "eks-addon"
  })

  depends_on = [aws_eks_node_group.main]
}

resource "aws_eks_addon" "ebs_csi_driver" {
  count = var.enable_ebs_csi_addon ? 1 : 0

  cluster_name             = aws_eks_cluster.main.name
  addon_name               = "aws-ebs-csi-driver"
  addon_version            = var.ebs_csi_addon_version
  resolve_conflicts        = "OVERWRITE"
  service_account_role_arn = var.ebs_csi_service_account_role_arn

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-ebs-csi-addon"
    Type = "eks-addon"
  })

  depends_on = [aws_eks_node_group.main]
}

# =============================================================================
# OIDC IDENTITY PROVIDER (for IRSA)
# =============================================================================
data "tls_certificate" "cluster" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "cluster" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.cluster.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer

  tags = merge(var.tags, {
    Name = "${var.cluster_name}-oidc-provider"
    Type = "oidc-provider"
  })
}
