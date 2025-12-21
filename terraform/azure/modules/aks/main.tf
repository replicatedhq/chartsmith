# AKS Cluster Module

resource "azurerm_log_analytics_workspace" "main" {
  count = var.log_analytics_workspace_enabled ? 1 : 0

  name                = "${var.cluster_name}-logs"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = var.tags
}

resource "azurerm_kubernetes_cluster" "main" {
  name                = var.cluster_name
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = var.cluster_name
  kubernetes_version  = var.kubernetes_version

  default_node_pool {
    name                = var.default_node_pool.name
    vm_size             = var.default_node_pool.vm_size
    vnet_subnet_id      = var.vnet_subnet_id
    enable_auto_scaling = var.default_node_pool.enable_auto_scaling
    node_count          = var.default_node_pool.node_count
    min_count           = var.default_node_pool.min_count
    max_count           = var.default_node_pool.max_count
    os_disk_size_gb     = var.default_node_pool.os_disk_size_gb
  }

  identity {
    type = var.identity_type
  }

  network_profile {
    network_plugin     = var.network_plugin
    network_policy     = var.network_policy
    load_balancer_sku  = var.load_balancer_sku
    dns_service_ip     = var.dns_service_ip
    service_cidr       = var.service_cidr
  }

  dynamic "oms_agent" {
    for_each = var.log_analytics_workspace_enabled ? [1] : []
    content {
      log_analytics_workspace_id = azurerm_log_analytics_workspace.main[0].id
    }
  }

  tags = var.tags
}

resource "azurerm_kubernetes_cluster_node_pool" "additional" {
  for_each = var.node_pools

  name                  = each.key
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size               = each.value.vm_size
  vnet_subnet_id        = var.vnet_subnet_id
  enable_auto_scaling   = each.value.enable_auto_scaling
  node_count            = each.value.node_count
  min_count             = each.value.min_count
  max_count             = each.value.max_count
  os_disk_size_gb       = each.value.os_disk_size_gb
  mode                  = each.value.mode

  node_labels = each.value.node_labels
  node_taints = each.value.node_taints

  tags = var.tags
}
