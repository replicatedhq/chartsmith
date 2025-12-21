output "instance_name" { value = google_sql_database_instance.main.name }
output "connection_name" { value = google_sql_database_instance.main.connection_name }
output "private_ip_address" { value = google_sql_database_instance.main.private_ip_address }
output "database_name" { value = google_sql_database.main.name }
output "database_version" { value = google_sql_database_instance.main.database_version }
output "username" { value = google_sql_user.main.name }
output "password" { value = random_password.database_password.result; sensitive = true }
output "connection_string" { 
  value = "postgresql://${google_sql_user.main.name}:${random_password.database_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.main.name}"
  sensitive = true 
}
