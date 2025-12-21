output "cluster_name" { value = google_container_cluster.main.name }
output "cluster_endpoint" { value = google_container_cluster.main.endpoint }
output "cluster_version" { value = google_container_cluster.main.master_version }
output "cluster_ca_certificate" { value = google_container_cluster.main.master_auth[0].cluster_ca_certificate; sensitive = true }
