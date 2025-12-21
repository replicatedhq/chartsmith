output "network_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.main.name
}

output "network_id" {
  description = "ID of the VPC network"
  value       = google_compute_network.main.id
}

output "subnet_name" {
  description = "Name of the subnet"
  value       = google_compute_subnetwork.main.name
}

output "subnet_cidr" {
  description = "CIDR block of the subnet"
  value       = google_compute_subnetwork.main.ip_cidr_range
}

output "pods_range_name" {
  description = "Name of the pods secondary IP range"
  value       = "${var.name_prefix}-pods"
}

output "services_range_name" {
  description = "Name of the services secondary IP range"
  value       = "${var.name_prefix}-services"
}

output "private_vpc_connection" {
  description = "Private VPC connection for Cloud SQL"
  value       = google_service_networking_connection.private_vpc_connection.network
}
