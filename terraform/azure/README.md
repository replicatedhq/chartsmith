# Chartsmith Azure Infrastructure

Create and manage Azure infrastructure for Chartsmith deployment.

## Overview

This Terraform configuration creates Azure infrastructure for Chartsmith with:

- **Flexible Infrastructure**: Create new or use existing VNet, AKS, and database
- **Security First**: Private networking, Managed Identity, least privilege access
- **Production Ready**: Zone redundancy, automated backups, monitoring
- **Modular Design**: Use only the components you need

## Quick Start

1. **Choose Your Deployment Scenario**:
   - [**Minimal**](examples/minimal/) - Create everything from scratch (recommended for new deployments)
   - [**Existing VNet**](examples/existing-vnet/) - Use your existing Virtual Network infrastructure
   - [**Existing Cluster**](examples/existing-cluster/) - Use your existing AKS cluster (coming soon)

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

### Current Implementation
```
┌─────────────────────────────────────────────────────────────┐
│                   Azure Subscription                        │
├─────────────────────────────────────────────────────────────┤
│  Resource Group                                             │
│  ├── Virtual Network (Optional - can use existing)         │
│  │   ├── AKS Subnet                                        │
│  │   │   └── AKS Cluster + Node Pools ✅                   │
│  │   └── Database Subnet                                   │
│  │       └── Azure Database for PostgreSQL + pgvector ✅   │
├─────────────────────────────────────────────────────────────┤
│  Network Security Groups ✅                                 │
│  ├── AKS NSG                                               │
│  └── Database NSG                                          │
├─────────────────────────────────────────────────────────────┤
│  Key Vault ✅                                               │
│  └── Database Connection String (if created)               │
└─────────────────────────────────────────────────────────────┘
```

## Requirements

### Azure Prerequisites

1. **Azure CLI configured** with credentials
2. **Terraform installed** (>= 1.5.0)
3. **Sufficient Azure permissions**:
   - `Network Contributor` (VNet, Subnets, NSG)
   - `Azure Kubernetes Service Contributor` (AKS cluster)
   - `SQL DB Contributor` (Azure Database for PostgreSQL)
   - `Key Vault Administrator` (Key Vault for secrets)
   - `Managed Identity Operator` (Service identities)

4. **Azure subscription with sufficient quotas**:
   - Virtual Networks: 1 additional (if creating new VNet)
   - Azure Database for PostgreSQL instances: 1 additional
   - AKS clusters: 1 additional
   - Standard SKU Load Balancers: 1 additional

## Deployment Scenarios

### 🆕 New Deployment (Recommended)
Use the [minimal example](examples/minimal/) to create everything from scratch:
- New Virtual Network with proper subnets
- AKS cluster with managed node pools
- Azure Database for PostgreSQL with pgvector
- All network security groups

**Best for**: First-time deployments, isolated environments

### 🔄 Existing VNet
Use the [existing VNet example](examples/existing-vnet/) to create infrastructure within your current network:
- Reuse your VNet and subnets
- Create AKS cluster and database
- Integrate with existing infrastructure

**Best for**: Adding Chartsmith to existing Azure environments

### 🏗️ Existing Cluster (Coming Soon)
Create minimal additional infrastructure:
- Use existing AKS cluster
- Use existing database
- Create only necessary supporting resources

**Best for**: Organizations with established Kubernetes platforms

## Configuration

### Basic Configuration
```hcl
# Environment identification
environment_name = "production"
azure_region = "eastus"
resource_group_name = "chartsmith-rg"

# Infrastructure choices
create_vnet = true         # Create new Virtual Network
create_database = true     # Create Azure Database for PostgreSQL
```

### Security Configuration
```hcl
# Restrict access (recommended)
allowed_cidr_blocks = [
  "203.0.113.0/24"    # Your office IP range
]

# Database security
database_sku_name = "B_Standard_B2s"
database_high_availability_mode = "Disabled"  # or "ZoneRedundant" for HA
```

## Monitoring & Operations

### What's Monitored
- **Azure Database Performance**: CPU, connections, storage
- **Azure Monitor**: Application and database logs
- **Key Vault Access**: Secret usage tracking

### Backup Strategy
- **Azure Database Automated Backups**: Configurable retention period
- **Point-in-time Recovery**: Available for databases
- **Geo-redundant Backups**: Optional for disaster recovery

### Security Features
- **Encryption at Rest**: All storage encrypted by default
- **Encryption in Transit**: TLS for all communications
- **Private Networking**: Private endpoints for database
- **Managed Identity**: Secure service authentication for AKS
- **Least Privilege**: Minimal required permissions

## Troubleshooting

### Common Issues

1. **Subscription Quota Exceeded**
   ```bash
   # Check quotas
   az vm list-usage --location eastus --output table
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connectivity
   az postgres flexible-server show --resource-group your-rg --name your-server
   ```

3. **Permission Denied**
   ```bash
   # Verify Azure credentials
   az account show
   az account list-locations -o table
   ```

## Development Status

### ✅ Completed
- VNet module with subnets for AKS and database
- Azure Database for PostgreSQL with pgvector extension
- Network Security Groups for all components
- AKS cluster with Azure CNI and managed identities
- Example configurations

### 🚧 Future Enhancements
- Managed Identity integration for service accounts
- Azure Application Gateway for ingress
- Additional monitoring and alerting
