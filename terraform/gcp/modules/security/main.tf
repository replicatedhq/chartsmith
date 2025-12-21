# GCP Firewall Rules Module

resource "google_compute_firewall" "allow_internal" {
  name    = "${var.name_prefix}-allow-internal"
  project = var.project_id
  network = var.network_name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/8"]
}

resource "google_compute_firewall" "allow_external" {
  name    = "${var.name_prefix}-allow-external"
  project = var.project_id
  network = var.network_name

  allow {
    protocol = "tcp"
    ports    = ["443", "80"]
  }

  source_ranges = var.allowed_cidr_blocks
}
