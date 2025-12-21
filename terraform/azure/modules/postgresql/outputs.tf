output "server_name" { value = azurerm_postgresql_flexible_server.main.name }
output "server_fqdn" { value = azurerm_postgresql_flexible_server.main.fqdn }
output "database_name" { value = azurerm_postgresql_flexible_server_database.main.name }
output "admin_username" { value = azurerm_postgresql_flexible_server.main.administrator_login }
output "admin_password" { value = random_password.database_password.result; sensitive = true }
output "connection_string" {
  value = "postgresql://${azurerm_postgresql_flexible_server.main.administrator_login}:${random_password.database_password.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.main.name}"
  sensitive = true
}
