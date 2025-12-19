# Chartsmith AWS Infrastructure

Create and manage AWS infrastructure for Chartsmith deployment.

## Overview

This Terraform configuration creates AWS infrastructure for Chartsmith with:

- **Flexible Infrastructure**: Create new or use existing VPC, EKS, and database
- **Security First**: Encrypted storage, private networking, least privilege access
- **Production Ready**: Multi-AZ support, automated backups, monitoring
- **Modular Design**: Use only the components you need

## Quick Start

1. **Choose Your Deployment Scenario**:
   - [**Minimal**](examples/minimal/) - Create everything from scratch (recommended for new deployments)
   - [**Existing VPC**](examples/existing-vpc/) - Use your existing VPC infrastructure
   - [**Existing Cluster**](examples/existing-cluster/) - Use your existing EKS cluster (coming soon)

2. **Create Infrastructure**:
   ```bash
   cd examples/minimal  # or your chosen example
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   terraform init
   terraform plan
   terraform apply
   ```

## Architecture

### Current Implementation (Phase 1)
```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Account                          │
├─────────────────────────────────────────────────────────────┤
│  VPC (Optional - can use existing)                         │
│  ├── Public Subnets                                        │
│  ├── Private Subnets                                       │
│  │   └── EKS Cluster + Node Groups ✅                      │
│  └── Database Subnets                                      │
│      └── RDS PostgreSQL + pgvector ✅                      │
├─────────────────────────────────────────────────────────────┤
│  Security Groups ✅                                         │
│  ├── EKS Cluster SG                                        │
│  ├── EKS Nodes SG                                          │
│  └── RDS SG                                                │
├─────────────────────────────────────────────────────────────┤
│  AWS Secrets Manager ✅                                     │
│  └── Database Credentials (if created)                     │
└─────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

### Coming Soon (Phase 2)
- EKS Cluster with IRSA (IAM Roles for Service Accounts)

## Requirements

### AWS Prerequisites

1. **AWS CLI configured** with credentials
2. **Terraform installed** (>= 1.0)
3. **Sufficient AWS permissions**:
   - `EC2FullAccess` (VPC, Security Groups)
   - `RDSFullAccess` (PostgreSQL database)
   - `SecretsManagerFullAccess` (API key storage)
   - `IAMFullAccess` (Service roles)


### AWS Resource Limits

Ensure your account has sufficient limits:
- **VPCs**: 1 additional (if creating new VPC)
- **RDS Instances**: 1 additional
- **Security Groups**: 5 additional

## Deployment Scenarios

### 🆕 New Deployment (Recommended)
Use the [minimal example](examples/minimal/) to create everything from scratch:
- New VPC with proper networking
- EKS cluster with managed node groups
- PostgreSQL database with pgvector
- All security groups

**Best for**: First-time deployments, isolated environments

### 🔄 Existing VPC
Use the [existing VPC example](examples/existing-vpc/) to create infrastructure within your current network:
- Reuse your VPC, subnets, and networking
- Create EKS cluster and database
- Integrate with existing infrastructure

**Best for**: Adding Chartsmith to existing AWS environments

### 🏗️ Existing Cluster (Coming Soon)
Create minimal additional infrastructure:
- Use existing EKS cluster
- Use existing database
- Create only necessary supporting resources

**Best for**: Organizations with established Kubernetes platforms

## Configuration

### Basic Configuration
```hcl
# Environment identification
environment_name = "production"
aws_region = "us-west-2"

# Infrastructure choices
create_vpc = true          # Create new VPC
create_database = true     # Create PostgreSQL database
```

### Security Configuration
```hcl
# Restrict access (recommended)
allowed_cidr_blocks = [
  "203.0.113.0/24"    # Your office IP range
]

# Database security
database_instance_class = "db.t3.small"
backup_retention_period = 7
```


## Monitoring & Operations

### What's Monitored
- **RDS Performance**: CPU, connections, storage
- **CloudWatch Logs**: Application and database logs
- **Secrets Access**: API key usage tracking

### Backup Strategy
- **RDS Automated Backups**: 7-day retention (configurable)
- **Point-in-time Recovery**: Available for databases
- **Secrets Versioning**: Automatic secret rotation support

### Security Features
- **Encryption at Rest**: All storage encrypted with KMS
- **Encryption in Transit**: TLS for all communications
- **Network Isolation**: Private subnets for sensitive resources
- **Least Privilege**: Minimal required permissions

## Troubleshooting

### Common Issues

1. **VPC CIDR Conflicts**
   ```bash
   # Check existing VPCs
   aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,CidrBlock]'
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connectivity
   aws rds describe-db-instances --db-instance-identifier your-db-name
   ```

3. **Permission Denied**
   ```bash
   # Verify AWS credentials
   aws sts get-caller-identity
   ```


## Development Status

### ✅ Completed (Phase 1)
- VPC module with flexible networking
- RDS PostgreSQL with pgvector extension
- Security groups for all components
- EKS cluster with managed node groups and IRSA support
- Customer example configurations

### 🚧 In Progress (Phase 2)
- IAM roles and policies for service accounts


