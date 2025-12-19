# =============================================================================
# TERRAFORM CONFIGURATION
# Provider and backend configuration for AWS deployment
# =============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# =============================================================================
# PROVIDER CONFIGURATION
# =============================================================================
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = "Chartsmith"
      ManagedBy   = "Terraform"
      Environment = var.environment_name
    }
  }
}

# Data source for current AWS region
data "aws_region" "current" {}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}
