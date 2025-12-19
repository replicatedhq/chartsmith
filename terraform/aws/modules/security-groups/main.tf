# =============================================================================
# SECURITY GROUPS MODULE
# Creates security groups for EKS cluster and RDS database
# =============================================================================

# Data source for VPC information
data "aws_vpc" "main" {
  id = var.vpc_id
}

# =============================================================================
# EKS CLUSTER SECURITY GROUP
# =============================================================================
resource "aws_security_group" "eks_cluster" {
  name_prefix = "${var.name_prefix}-eks-cluster"
  vpc_id      = var.vpc_id
  description = "Security group for EKS cluster control plane"

  # Allow HTTPS traffic from worker nodes
  ingress {
    description = "HTTPS from worker nodes"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  # Allow all outbound traffic
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-eks-cluster-sg"
    Type = "security-group"
    Component = "eks-cluster"
  })
}

# =============================================================================
# EKS WORKER NODES SECURITY GROUP
# =============================================================================
resource "aws_security_group" "eks_nodes" {
  name_prefix = "${var.name_prefix}-eks-nodes"
  vpc_id      = var.vpc_id
  description = "Security group for EKS worker nodes"

  # Allow nodes to communicate with each other
  ingress {
    description = "Node to node communication"
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    self        = true
  }

  # Allow worker Kubelets and pods to receive communication from the cluster control plane
  ingress {
    description = "Control plane to worker nodes"
    from_port   = 1025
    to_port     = 65535
    protocol    = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  # Allow pods running extension API servers on port 443 to receive communication from cluster control plane
  ingress {
    description = "Control plane to worker nodes (HTTPS)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  # Allow all outbound traffic
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-eks-nodes-sg"
    Type = "security-group"
    Component = "eks-nodes"
  })
}

# =============================================================================
# RDS DATABASE SECURITY GROUP
# =============================================================================
resource "aws_security_group" "rds" {
  name_prefix = "${var.name_prefix}-rds"
  vpc_id      = var.vpc_id
  description = "Security group for RDS PostgreSQL database"

  # Allow PostgreSQL traffic from EKS nodes
  ingress {
    description = "PostgreSQL from EKS nodes"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  # Allow PostgreSQL traffic from bastion host (if enabled)
  dynamic "ingress" {
    for_each = var.enable_bastion ? [1] : []
    content {
      description = "PostgreSQL from bastion host"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      security_groups = [aws_security_group.bastion[0].id]
    }
  }

  # Allow PostgreSQL traffic from allowed CIDR blocks (for external access)
  dynamic "ingress" {
    for_each = var.allow_external_database_access ? [1] : []
    content {
      description = "PostgreSQL from allowed CIDR blocks"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = var.allowed_cidr_blocks
    }
  }

  # No outbound rules needed for RDS

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rds-sg"
    Type = "security-group"
    Component = "rds"
  })
}


# =============================================================================
# BASTION HOST SECURITY GROUP (OPTIONAL)
# =============================================================================
resource "aws_security_group" "bastion" {
  count = var.enable_bastion ? 1 : 0

  name_prefix = "${var.name_prefix}-bastion"
  vpc_id      = var.vpc_id
  description = "Security group for bastion host"

  # Allow SSH from allowed CIDR blocks
  ingress {
    description = "SSH from allowed sources"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # Allow all outbound traffic
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-bastion-sg"
    Type = "security-group"
    Component = "bastion"
  })
}

# =============================================================================
# VPC ENDPOINTS SECURITY GROUP (FOR PRIVATE CONNECTIVITY)
# =============================================================================
resource "aws_security_group" "vpc_endpoints" {
  count = var.enable_vpc_endpoints ? 1 : 0

  name_prefix = "${var.name_prefix}-vpc-endpoints"
  vpc_id      = var.vpc_id
  description = "Security group for VPC endpoints"

  # Allow HTTPS from VPC CIDR
  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
  }

  # Allow all outbound traffic
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc-endpoints-sg"
    Type = "security-group"
    Component = "vpc-endpoints"
  })
}
