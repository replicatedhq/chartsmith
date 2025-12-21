# =============================================================================
# AZURE DEPLOYMENT OUTPUTS
# Information customers get after successful deployment
# =============================================================================

# =============================================================================
# DEPLOYMENT INFORMATION
# =============================================================================
output "deployment_info" {
  description = "Summary of deployment information"
  value = {
    environment_name    = var.environment_name
    azure_region        = var.azure_region
    resource_group_name = azurerm_resource_group.main.name
    vnet_created        = var.create_vnet
    aks_created         = var.create_aks_cluster
    database_created    = var.create_database
    cluster_name        = var.create_aks_cluster ? module.aks[0].cluster_name : var.existing_cluster_name
  }
}

# =============================================================================
# NETWORK INFORMATION
# =============================================================================
output "vnet_info" {
  description = "Virtual Network information"
  value = var.create_vnet ? {
    vnet_id             = module.vnet[0].vnet_id
    vnet_name           = module.vnet[0].vnet_name
    vnet_cidr           = var.vnet_cidr
    aks_subnet_id       = module.vnet[0].aks_subnet_id
    database_subnet_id  = module.vnet[0].database_subnet_id
    } : {
    vnet_id = var.existing_vnet_id
    message = "Using existing Virtual Network"
  }
}

# =============================================================================
# DATABASE INFORMATION
# =============================================================================
output "database_info" {
  description = "Azure Database for PostgreSQL connection information"
  value = var.create_database ? {
    server_name      = module.postgresql[0].server_name
    server_fqdn      = module.postgresql[0].server_fqdn
    database_name    = module.postgresql[0].database_name
    server_version   = var.database_version
    sku_name         = var.database_sku_name
    storage_mb       = var.database_storage_mb
    } : {
    server_name = var.existing_database_server
    message     = "Using existing PostgreSQL server"
  }
  sensitive = true
}

# =============================================================================
# AKS CLUSTER INFORMATION
# =============================================================================
output "aks_info" {
  description = "AKS cluster information"
  value = var.create_aks_cluster ? {
    cluster_name    = module.aks[0].cluster_name
    cluster_fqdn    = module.aks[0].cluster_fqdn
    cluster_version = module.aks[0].cluster_version
    node_pools      = keys(var.node_pools)
    kubectl_config  = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${module.aks[0].cluster_name}"
    } : {
    cluster_name = var.existing_cluster_name
    message      = "Using existing AKS cluster"
  }
}

# =============================================================================
# SECRETS INFORMATION
# =============================================================================
output "secrets_info" {
  description = "Information about created secrets"
  value = {
    key_vault_name  = var.create_database ? azurerm_key_vault.main[0].name : null
    secrets_created = var.create_database ? ["database-connection-string"] : []
    resource_group  = azurerm_resource_group.main.name
  }
}

# =============================================================================
# NEXT STEPS FOR CUSTOMER
# =============================================================================
output "next_steps" {
  description = "What to do after deployment"
  value       = <<-EOT
    ✅ Chartsmith Azure infrastructure deployed successfully!

    📋 What was created:
    ${var.create_vnet ? "- Virtual Network with subnets for AKS and database" : "- Used existing Virtual Network"}
    ${var.create_aks_cluster ? "- AKS cluster with managed node pools and Azure CNI" : "- Configured for existing AKS cluster"}
    ${var.create_database ? "- Azure Database for PostgreSQL with pgvector extension" : "- Configured for existing database"}
    - Network Security Groups for AKS and database
    ${var.create_database ? "- Database connection string in Key Vault" : ""}

    📚 Resources:
    - Resource Group: ${azurerm_resource_group.main.name}
    - Virtual Network: ${local.vnet_name}
    ${var.create_aks_cluster ? "- AKS Cluster: ${module.aks[0].cluster_name}" : "- AKS Cluster: ${var.existing_cluster_name} (existing)"}
    - Database: ${var.create_database ? module.postgresql[0].server_fqdn : var.existing_database_server}
    ${var.create_database ? "- Key Vault: ${azurerm_key_vault.main[0].name}" : ""}

    🔧 Manual steps required:
    1. Configure kubectl access: ${var.create_aks_cluster ? "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${module.aks[0].cluster_name}" : "az aks get-credentials --name ${var.existing_cluster_name}"}
    2. Deploy Chartsmith via Helm
    3. Verify database connectivity and pgvector extension

  EOT
}

# =============================================================================
# TERRAFORM STATE INFORMATION
# =============================================================================
output "terraform_info" {
  description = "Terraform state information"
  value = {
    terraform_version   = "~> 1.5"
    azurerm_provider_version = "~> 3.0"
    resource_group      = azurerm_resource_group.main.name
    region              = var.azure_region
    state_backend       = "Configure remote state backend for production use"
  }
}

# =============================================================================
# SENSITIVE OUTPUTS (for automation)
# =============================================================================
output "database_connection_string" {
  description = "Database connection string"
  value       = var.create_database ? module.postgresql[0].connection_string : "Configure manually for existing database"
  sensitive   = true
}

output "key_vault_uri" {
  description = "URI of Key Vault"
  value       = var.create_database ? azurerm_key_vault.main[0].vault_uri : null
  sensitive   = true
}
