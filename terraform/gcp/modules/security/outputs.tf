output "firewall_rules" {
  value = [
    google_compute_firewall.allow_internal.name,
    google_compute_firewall.allow_external.name
  ]
}
