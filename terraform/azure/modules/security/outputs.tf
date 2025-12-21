output "aks_nsg_id" { value = azurerm_network_security_group.aks.id }
output "database_nsg_id" { value = azurerm_network_security_group.database.id }
