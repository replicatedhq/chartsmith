# =============================================================================
# CHARTSMITH AZURE DEPLOYMENT
# Complete Azure infrastructure for self-hosted Chartsmith
# =============================================================================

locals {
  name_prefix = "chartsmith-${var.environment_name}"

  common_tags = merge(var.tags, {
    Application   = "Chartsmith"
    Environment   = var.environment_name
    ManagedBy     = "Terraform"
    CloudProvider = "Azure"
  })

  # Determine which network/subnets to use based on whether VNet is created or existing
  vnet_id            = var.create_vnet ? module.vnet[0].vnet_id : var.existing_vnet_id
  vnet_name          = var.create_vnet ? module.vnet[0].vnet_name : var.existing_vnet_name
  aks_subnet_id      = var.create_vnet ? module.vnet[0].aks_subnet_id : var.existing_aks_subnet_id
  database_subnet_id = var.create_vnet ? module.vnet[0].database_subnet_id : var.existing_database_subnet_id
}

# =============================================================================
# RESOURCE GROUP
# =============================================================================
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.azure_region

  tags = local.common_tags
}

# =============================================================================
# VALIDATION CHECKS
# =============================================================================
resource "terraform_data" "validate_existing_vnet_config" {
  count = var.create_vnet ? 0 : 1

  lifecycle {
    precondition {
      condition     = var.existing_vnet_id != ""
      error_message = "When using existing VNet (create_vnet = false), you must provide existing_vnet_id."
    }

    precondition {
      condition     = var.existing_aks_subnet_id != ""
      error_message = "When using existing VNet (create_vnet = false), you must provide existing_aks_subnet_id."
    }
  }
}

# =============================================================================
# VNET MODULE
# =============================================================================
module "vnet" {
  count  = var.create_vnet ? 1 : 0
  source = "./modules/vnet"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  name_prefix         = local.name_prefix

  vnet_cidr              = var.vnet_cidr
  aks_subnet_cidr        = var.aks_subnet_cidr
  database_subnet_cidr   = var.database_subnet_cidr

  tags = local.common_tags
}

# =============================================================================
# SECURITY (Network Security Groups)
# =============================================================================
module "security" {
  source = "./modules/security"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  name_prefix         = local.name_prefix

  allowed_cidr_blocks = var.allowed_cidr_blocks

  tags = local.common_tags

  depends_on = [module.vnet]
}

# =============================================================================
# KEY VAULT FOR SECRETS
# =============================================================================
data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  count = var.create_database ? 1 : 0

  name                = "${local.name_prefix}-kv"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  purge_protection_enabled   = true
  soft_delete_retention_days = 7

  network_acls {
    default_action = "Allow"
    bypass         = "AzureServices"
  }

  tags = merge(local.common_tags, {
    Component = "secrets"
  })
}

resource "azurerm_key_vault_secret" "database_connection" {
  count = var.create_database ? 1 : 0

  name         = "database-connection-string"
  value        = module.postgresql[0].connection_string
  key_vault_id = azurerm_key_vault.main[0].id

  depends_on = [module.postgresql]
}

# =============================================================================
# AZURE DATABASE FOR POSTGRESQL MODULE
# =============================================================================
module "postgresql" {
  count  = var.create_database ? 1 : 0
  source = "./modules/postgresql"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  name_prefix         = local.name_prefix

  # Instance configuration
  sku_name          = var.database_sku_name
  server_version    = var.database_version
  storage_mb        = var.database_storage_mb
  
  # Database configuration
  database_name = var.database_name
  admin_username = var.database_username

  # Network configuration
  delegated_subnet_id = local.database_subnet_id
  private_dns_zone_id = var.create_vnet ? module.vnet[0].private_dns_zone_id : var.existing_private_dns_zone_id

  # Backup configuration
  backup_retention_days        = var.backup_retention_days
  geo_redundant_backup_enabled = var.geo_redundant_backup_enabled

  # High availability
  high_availability_mode = var.database_high_availability_mode

  tags = local.common_tags

  depends_on = [module.vnet]
}

# =============================================================================
# AKS CLUSTER MODULE
# =============================================================================
module "aks" {
  count  = var.create_aks_cluster ? 1 : 0
  source = "./modules/aks"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  cluster_name        = "${local.name_prefix}-aks"

  kubernetes_version = var.kubernetes_version

  vnet_subnet_id = local.aks_subnet_id

  # System node pool
  default_node_pool = var.default_node_pool

  # Additional node pools
  node_pools = var.node_pools

  # Identity
  identity_type = "SystemAssigned"

  # Networking
  network_plugin      = "azure"
  network_policy      = "azure"
  load_balancer_sku   = "standard"
  dns_service_ip      = var.aks_dns_service_ip
  service_cidr        = var.aks_service_cidr

  # Logging
  log_analytics_workspace_enabled = true

  tags = local.common_tags

  depends_on = [module.vnet, module.security]
}
