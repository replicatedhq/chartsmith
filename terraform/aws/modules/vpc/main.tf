# =============================================================================
# VPC MODULE
# Creates VPC with public, private, and database subnets
# Supports flexible AZ selection and optional NAT/VPN gateways
# =============================================================================

locals {
  # Use provided AZs or select first 3 available
  availability_zones = length(var.availability_zones) > 0 ? var.availability_zones : slice(data.aws_availability_zones.available.names, 0, 3)

  # Calculate number of subnets needed
  subnet_count = length(local.availability_zones)

  # Ensure we have enough CIDR blocks
  private_cidrs  = slice(var.private_subnet_cidrs, 0, local.subnet_count)
  public_cidrs   = slice(var.public_subnet_cidrs, 0, local.subnet_count)
  database_cidrs = slice(var.database_subnet_cidrs, 0, local.subnet_count)
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# =============================================================================
# VPC
# =============================================================================
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
    Type = "vpc"
  })
}

# =============================================================================
# INTERNET GATEWAY
# =============================================================================
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-igw"
    Type = "internet-gateway"
  })
}

# =============================================================================
# PUBLIC SUBNETS
# =============================================================================
resource "aws_subnet" "public" {
  count = local.subnet_count

  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_cidrs[count.index]
  availability_zone       = local.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${local.availability_zones[count.index]}"
    Type = "public-subnet"
    "kubernetes.io/role/elb" = "1"  # For AWS Load Balancer Controller
  })
}

# =============================================================================
# PRIVATE SUBNETS
# =============================================================================
resource "aws_subnet" "private" {
  count = local.subnet_count

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_cidrs[count.index]
  availability_zone = local.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${local.availability_zones[count.index]}"
    Type = "private-subnet"
    "kubernetes.io/role/internal-elb" = "1"  # For AWS Load Balancer Controller
  })
}

# =============================================================================
# DATABASE SUBNETS
# =============================================================================
resource "aws_subnet" "database" {
  count = local.subnet_count

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.database_cidrs[count.index]
  availability_zone = local.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-database-${local.availability_zones[count.index]}"
    Type = "database-subnet"
  })
}

# =============================================================================
# DATABASE SUBNET GROUP
# =============================================================================
resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.database[*].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-subnet-group"
    Type = "database-subnet-group"
  })
}

# =============================================================================
# ELASTIC IPS FOR NAT GATEWAYS
# =============================================================================
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? local.subnet_count : 0

  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-eip-${local.availability_zones[count.index]}"
    Type = "elastic-ip"
  })

  depends_on = [aws_internet_gateway.main]
}

# =============================================================================
# NAT GATEWAYS
# =============================================================================
resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? local.subnet_count : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-${local.availability_zones[count.index]}"
    Type = "nat-gateway"
  })

  depends_on = [aws_internet_gateway.main]
}

# =============================================================================
# VPN GATEWAY (OPTIONAL)
# =============================================================================
resource "aws_vpn_gateway" "main" {
  count = var.enable_vpn_gateway ? 1 : 0

  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpn-gateway"
    Type = "vpn-gateway"
  })
}

# =============================================================================
# ROUTE TABLES
# =============================================================================

# Public route table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-rt"
    Type = "route-table"
  })
}

# Private route tables (one per AZ for NAT Gateway)
resource "aws_route_table" "private" {
  count = local.subnet_count

  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.main[count.index].id
    }
  }

  dynamic "route" {
    for_each = var.enable_vpn_gateway ? [1] : []
    content {
      cidr_block = var.vpn_gateway_cidr
      gateway_id = aws_vpn_gateway.main[0].id
    }
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-rt-${local.availability_zones[count.index]}"
    Type = "route-table"
  })
}

# Database route table
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_vpn_gateway ? [1] : []
    content {
      cidr_block = var.vpn_gateway_cidr
      gateway_id = aws_vpn_gateway.main[0].id
    }
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-database-rt"
    Type = "route-table"
  })
}

# =============================================================================
# ROUTE TABLE ASSOCIATIONS
# =============================================================================

# Public subnet associations
resource "aws_route_table_association" "public" {
  count = local.subnet_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private subnet associations
resource "aws_route_table_association" "private" {
  count = local.subnet_count

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Database subnet associations
resource "aws_route_table_association" "database" {
  count = local.subnet_count

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# =============================================================================
# VPC ENDPOINTS (Optional - for private connectivity to AWS services)
# =============================================================================

# S3 VPC Endpoint
resource "aws_vpc_endpoint" "s3" {
  count = var.enable_vpc_endpoints ? 1 : 0

  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat([aws_route_table.public.id], aws_route_table.private[*].id)

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-s3-endpoint"
    Type = "vpc-endpoint"
  })
}

# ECR VPC Endpoints (for EKS)
resource "aws_vpc_endpoint" "ecr_dkr" {
  count = var.enable_vpc_endpoints ? 1 : 0

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-ecr-dkr-endpoint"
    Type = "vpc-endpoint"
  })
}

resource "aws_vpc_endpoint" "ecr_api" {
  count = var.enable_vpc_endpoints ? 1 : 0

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-ecr-api-endpoint"
    Type = "vpc-endpoint"
  })
}

# Security group for VPC endpoints
resource "aws_security_group" "vpc_endpoints" {
  count = var.enable_vpc_endpoints ? 1 : 0

  name_prefix = "${var.name_prefix}-vpc-endpoints"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc-endpoints-sg"
    Type = "security-group"
  })
}

# Data source for current region
data "aws_region" "current" {}
