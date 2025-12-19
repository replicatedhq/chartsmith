# Minimal AWS Infrastructure

This example creates AWS infrastructure for Chartsmith with all new resources.

## What Gets Created

- **VPC**: New VPC with public, private, and database subnets across 3 AZs
- **PostgreSQL Database**: RDS PostgreSQL with pgvector extension
- **Security Groups**: Configured for EKS cluster and RDS database
- **Secrets**: AWS Secrets Manager secrets for all API keys and credentials
- **NAT Gateways**: For private subnet internet access

## Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Terraform installed** (>= 1.0)
3. **API Keys obtained** from required services

### Required API Keys

Get these before deployment:

| Service | Sign Up URL | API Key Format |
|---------|-------------|----------------|
| Anthropic Claude | https://console.anthropic.com/ | `sk-ant-...` |
| Groq | https://console.groq.com/ | `gsk_...` |
| Voyage AI | https://dash.voyageai.com/ | `pa-...` |
| Google OAuth | https://console.cloud.google.com/ | Client ID + Secret |

### AWS Permissions Required

Your AWS credentials need these permissions:
- `EC2FullAccess` (for VPC, security groups)
- `RDSFullAccess` (for PostgreSQL database)
- `SecretsManagerFullAccess` (for API key storage)
- `IAMFullAccess` (for service roles)

## Quick Start

1. **Copy configuration**:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. **Edit terraform.tfvars**:
   - Set your `environment_name`
   - Add all required API keys
   - Customize other settings as needed

3. **Deploy**:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

## Configuration Options

### Basic Settings
```hcl
environment_name = "production"     # Environment identifier (used for resource naming)
aws_region = "us-west-2"           # AWS region
```

### Security Settings
```hcl
# Restrict access to your IP ranges (recommended)
allowed_cidr_blocks = [
  "203.0.113.0/24",    # Your office
  "198.51.100.0/24"    # Your VPN
]
```

### Database Settings
```hcl
database_instance_class = "db.t3.small"     # Start small, can upgrade
database_allocated_storage = 100            # GB, auto-scales up to 1TB
backup_retention_period = 7                 # Days to keep backups
```


## After Deployment

1. **Check outputs**:
   ```bash
   terraform output
   ```

2. **Verify database**:
   - Check AWS RDS console
   - Verify pgvector extension is available

3. **Check secrets**:
   - Verify all secrets in AWS Secrets Manager
   - Test secret retrieval

4. **Next steps**:
   - Wait for EKS module implementation
   - Configure DNS (if using custom domain)
   - Set up monitoring and alerting

## Troubleshooting

### Common Issues

1. **API key validation fails**:
   - Check API key format (must start with correct prefix)
   - Verify keys are active and have sufficient credits

2. **VPC CIDR conflicts**:
   - Change `vpc_cidr` if conflicts with existing networks
   - Ensure subnet CIDRs don't overlap

3. **RDS creation fails**:
   - Check if you have sufficient RDS instance limits
   - Verify subnet group has subnets in multiple AZs

4. **Permission denied**:
   - Verify AWS credentials have required permissions
   - Check AWS CLI configuration: `aws sts get-caller-identity`


## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will delete your database and all data. Make sure you have backups if needed.
