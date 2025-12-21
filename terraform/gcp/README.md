# Chartsmith GCP Infrastructure

Create and manage GCP infrastructure for Chartsmith deployment.

## Overview

This Terraform configuration creates GCP infrastructure for Chartsmith with:

- **Flexible Infrastructure**: Create new or use existing VPC, GKE, and database
- **Security First**: Private networking, Workload Identity, least privilege access
- **Production Ready**: Regional availability, automated backups, monitoring
- **Modular Design**: Use only the components you need

## Quick Start

1. **Choose Your Deployment Scenario**:
   - [**Minimal**](examples/minimal/) - Create everything from scratch (recommended for new deployments)
   - [**Existing VPC**](examples/existing-vpc/) - Use your existing VPC infrastructure
   - [**Existing Cluster**](examples/existing-cluster/) - Use your existing GKE cluster (coming soon)

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
│                        GCP Project                          │
├─────────────────────────────────────────────────────────────┤
│  VPC Network (Optional - can use existing)                 │
│  ├── Subnet with Secondary Ranges                          │
│  │   ├── Primary: Nodes                                    │
│  │   ├── Secondary: Pods                                   │
│  │   └── Secondary: Services                               │
│  │   └── GKE Cluster + Node Pools ✅                       │
│  └── Private Service Connection                            │
│      └── Cloud SQL PostgreSQL + pgvector ✅                │
├─────────────────────────────────────────────────────────────┤
│  Firewall Rules ✅                                          │
│  ├── GKE Control Plane                                     │
│  ├── GKE Nodes                                             │
│  └── Cloud SQL                                             │
├─────────────────────────────────────────────────────────────┤
│  Secret Manager ✅                                          │
│  └── Database Credentials (if created)                     │
└─────────────────────────────────────────────────────────────┘
```

## Requirements

### GCP Prerequisites

1. **gcloud CLI configured** with credentials
2. **Terraform installed** (>= 1.5.0)
3. **Sufficient GCP permissions**:
   - `Compute Network Admin` (VPC, Subnets, Firewall)
   - `Kubernetes Engine Admin` (GKE cluster)
   - `Cloud SQL Admin` (PostgreSQL database)
   - `Secret Manager Admin` (API key storage)
   - `Service Account Admin` (Service accounts and IAM)

4. **APIs enabled in your GCP project**:
   - Compute Engine API
   - Kubernetes Engine API
   - Cloud SQL Admin API
   - Secret Manager API
   - Service Networking API

### GCP Resource Quotas

Ensure your project has sufficient quotas:
- **VPCs**: 1 additional (if creating new VPC)
- **Cloud SQL instances**: 1 additional
- **GKE clusters**: 1 additional

## Deployment Scenarios

### 🆕 New Deployment (Recommended)
Use the [minimal example](examples/minimal/) to create everything from scratch:
- New VPC with proper networking
- GKE cluster with managed node pools
- Cloud SQL PostgreSQL with pgvector
- All firewall rules

**Best for**: First-time deployments, isolated environments

### 🔄 Existing VPC
Use the [existing VPC example](examples/existing-vpc/) to create infrastructure within your current network:
- Reuse your VPC and subnets
- Create GKE cluster and database
- Integrate with existing infrastructure

**Best for**: Adding Chartsmith to existing GCP environments

### 🏗️ Existing Cluster (Coming Soon)
Create minimal additional infrastructure:
- Use existing GKE cluster
- Use existing database
- Create only necessary supporting resources

**Best for**: Organizations with established Kubernetes platforms

## Configuration

### Basic Configuration
```hcl
# Environment identification
environment_name = "production"
gcp_project = "your-project-id"
gcp_region = "us-central1"

# Infrastructure choices
create_vpc = true          # Create new VPC
create_database = true     # Create Cloud SQL PostgreSQL database
```

### Security Configuration
```hcl
# Restrict access (recommended)
allowed_cidr_blocks = [
  "203.0.113.0/24"    # Your office IP range
]

# Database security
database_tier = "db-custom-2-7680"
database_availability_type = "ZONAL"  # or "REGIONAL" for HA
```

## Monitoring & Operations

### What's Monitored
- **Cloud SQL Performance**: CPU, connections, storage
- **Cloud Logging**: Application and database logs
- **Secret Manager Access**: API key usage tracking

### Backup Strategy
- **Cloud SQL Automated Backups**: Daily backups with point-in-time recovery
- **Secret Manager Versioning**: Automatic secret versioning

### Security Features
- **Encryption at Rest**: All storage encrypted by default
- **Encryption in Transit**: TLS for all communications
- **Private Networking**: Private IP for Cloud SQL
- **Workload Identity**: Secure service account authentication for GKE
- **Least Privilege**: Minimal required permissions

## Troubleshooting

### Common Issues

1. **API Not Enabled**
   ```bash
   # Enable required APIs
   gcloud services enable compute.googleapis.com
   gcloud services enable container.googleapis.com
   gcloud services enable sqladmin.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   gcloud services enable servicenetworking.googleapis.com
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connectivity
   gcloud sql instances describe your-instance-name
   ```

3. **Permission Denied**
   ```bash
   # Verify GCP credentials
   gcloud auth list
   gcloud config get-value project
   ```

## Development Status

### ✅ Completed
- VPC module with secondary ranges for GKE
- Cloud SQL PostgreSQL with pgvector extension
- Firewall rules for all components
- GKE cluster with Workload Identity
- Example configurations

### 🚧 Future Enhancements
- IAM roles and service accounts for Workload Identity
- Cloud Armor for DDoS protection
- Additional monitoring and alerting
