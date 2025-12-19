# Existing VPC Infrastructure

Create Chartsmith infrastructure within your existing AWS VPC.

## What Gets Created

- **PostgreSQL Database**: RDS PostgreSQL with pgvector extension in your VPC
- **Security Groups**: New security groups for Chartsmith components
- **Secrets**: AWS Secrets Manager secrets for API keys and credentials

## What You Need to Provide

- **Existing VPC ID**: Your VPC must have internet connectivity
- **Private Subnets**: For EKS nodes and database (minimum 2, different AZs)
- **Public Subnets**: For Kubernetes ingress/load balancers (minimum 2, different AZs)
- **Database Subnets**: Optional - if not provided, database will use private subnets

## Prerequisites

### VPC Requirements

Your existing VPC must have:

1. **Internet Gateway**: Attached to VPC for public subnet internet access
2. **NAT Gateway or NAT Instance**: For private subnet internet access
3. **Route Tables**: Properly configured for public and private subnets
4. **Multiple AZs**: Subnets spread across at least 2 availability zones

### Subnet Requirements

| Subnet Type | Purpose | Requirements |
|-------------|---------|--------------|
| Private | EKS worker nodes, Database (if no dedicated DB subnets) | Internet via NAT Gateway, different AZs |
| Public | Kubernetes ingress | Internet via Internet Gateway, different AZs |
| Database | Database only (optional) | No internet access required, different AZs |

### How to Find Your Subnet IDs

1. **AWS Console**: VPC → Subnets
2. **AWS CLI**:
   ```bash
   # List all subnets in your VPC
   aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-YOUR-VPC-ID"
   
   # Filter by subnet type
   aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-YOUR-VPC-ID" "Name=tag:Name,Values=*private*"
   ```

## Configuration Guide

### 1. VPC Information
```hcl
existing_vpc_id = "vpc-0123456789abcdef0"    # Your VPC ID
```

### 2. Subnet Configuration
```hcl
# Private subnets (for EKS nodes and database)
existing_subnet_ids = [
  "subnet-0123456789abcdef0",    # Private subnet AZ-a
  "subnet-0123456789abcdef1",    # Private subnet AZ-b
  "subnet-0123456789abcdef2"     # Private subnet AZ-c (optional)
]

# Public subnets (for Kubernetes ingress)
existing_public_subnet_ids = [
  "subnet-0fedcba987654321",     # Public subnet AZ-a
  "subnet-0fedcba987654322"      # Public subnet AZ-b
]

# Database subnets (optional - will use private subnets if not provided)
# existing_database_subnet_ids = [
#   "subnet-0abcdef123456789",     # Database subnet AZ-a
#   "subnet-0abcdef123456790"      # Database subnet AZ-b
# ]
```

### 3. Database Subnet Configuration (Optional)
```hcl
# Option 1: Use dedicated database subnets (recommended for production)
existing_database_subnet_ids = [
  "subnet-0abcdef123456789",     # Database subnet AZ-a
  "subnet-0abcdef123456790"      # Database subnet AZ-b
]

# Option 2: Omit this variable to use private subnets for database
# If existing_database_subnet_ids is empty or not provided,
# the database will automatically be placed in your private subnets
```

### 4. Security Configuration
```hcl
# Include your VPC CIDR and external access
allowed_cidr_blocks = [
  "10.0.0.0/16",        # Your VPC CIDR block
  "203.0.113.0/24"      # Your office IP range
]
```

## Deployment Steps

1. **Verify VPC Setup**:
   ```bash
   # Check VPC exists and has internet gateway
   aws ec2 describe-vpcs --vpc-ids vpc-YOUR-VPC-ID
   aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=vpc-YOUR-VPC-ID"
   
   # Check NAT Gateway exists
   aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=vpc-YOUR-VPC-ID"
   ```

2. **Configure terraform.tfvars**:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit with your VPC and subnet IDs
   ```

3. **Deploy**:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

## Network Architecture

```
Your Existing VPC
├── Internet Gateway (existing)
├── Public Subnets (existing)
│   └── Kubernetes Ingress/LoadBalancer (via Helm)
├── Private Subnets (existing)
│   ├── EKS Worker Nodes (will be created)
│   └── RDS Database (created here if no dedicated DB subnets)
├── Database Subnets (optional)
│   └── RDS Database (created here if dedicated DB subnets provided)
└── NAT Gateway (existing)
```

## Security Considerations

### Security Groups Created

1. **EKS Cluster Security Group**: Controls access to Kubernetes API
2. **EKS Nodes Security Group**: Controls worker node communication
3. **RDS Security Group**: Restricts database access to EKS nodes only

### Network Security

- Database is placed in private subnets (no internet access)
- Security groups follow least privilege principle
- All communication encrypted in transit

## Troubleshooting

### Common Issues

1. **Subnet not found**:
   - Verify subnet IDs are correct
   - Check subnets exist in the specified region

2. **Database creation fails**:
   - Ensure private subnets are in different AZs
   - Check subnet has sufficient IP addresses available

3. **No internet connectivity**:
   - Verify NAT Gateway exists and is properly configured
   - Check route tables for private subnets

4. **Security group conflicts**:
   - Review existing security group rules
   - Ensure no conflicting rules block required ports

### Validation Commands

```bash
# Verify VPC setup
aws ec2 describe-vpcs --vpc-ids YOUR-VPC-ID
aws ec2 describe-subnets --subnet-ids subnet-1 subnet-2 subnet-3

# Check route tables
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=YOUR-VPC-ID"

# Verify internet connectivity
aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=YOUR-VPC-ID"
aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=YOUR-VPC-ID"
```

## Migration from Other Examples

### From Minimal Deployment
If you previously used the minimal example and want to migrate to existing VPC:

1. Export data from current deployment
2. Update configuration to use existing VPC
3. Import existing resources where possible
4. Plan migration carefully to avoid downtime

## Next Steps

After successful deployment:

1. **Verify database connectivity** from your existing infrastructure
2. **Test security group rules** allow proper communication
3. **Configure monitoring** for new resources
4. **Update DNS** if using custom domain
5. **Plan for EKS integration** when module becomes available

