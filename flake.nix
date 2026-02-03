{
  description = "Chartsmith development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-darwin" "aarch64-darwin" "x86_64-linux" "aarch64-linux" ] (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        # Go 1.24 as required by go.mod
        go = pkgs.go_1_24 or pkgs.go;

        # SchemaHero binary derivation
        schemahero = pkgs.stdenv.mkDerivation rec {
          pname = "schemahero";
          version = "0.23.0";

          platform = if pkgs.stdenv.isDarwin then "darwin" else "linux";
          arch = if pkgs.stdenv.isAarch64 then "arm64" else "amd64";

          src = pkgs.fetchurl {
            url = "https://github.com/schemahero/schemahero/releases/download/v${version}/kubectl-schemahero_${platform}_${arch}.tar.gz";
            sha256 = {
              "darwin-arm64" = "sha256-mpR5Xv816RqMvBruVSC3YtvLddqItgn4MYXLpJYEus4=";
              "darwin-amd64" = "sha256-aEgWPyATpRu5Z1Yem9k1h53v4Qzx8sq6KBUjyLgrjJg=";
              "linux-amd64"  = "sha256-MbdIHeOXrO3upXuHlbvXQZuo80I8Kgz3y0l4DGqawLw=";
              "linux-arm64"  = "sha256-hRNdhPAZjcii3hVpKZ6m3pOujiuFGp35YIQwC9dTzoI=";
            }."${platform}-${arch}";
          };

          sourceRoot = ".";
          dontUnpack = true;

          installPhase = ''
            runHook preInstall
            mkdir -p $out/bin
            tar -xzf $src -C $out/bin
            mv $out/bin/kubectl-schemahero $out/bin/schemahero
            chmod +x $out/bin/schemahero
            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Declarative database schema management";
            homepage = "https://schemahero.io/";
            platforms = platforms.unix;
          };
        };

        # Replicated CLI binary derivation
        replicated = pkgs.stdenv.mkDerivation rec {
          pname = "replicated";
          version = "0.124.0";

          platform =
            if pkgs.stdenv.isDarwin then "darwin_all"
            else if pkgs.stdenv.isAarch64 then "linux_arm64"
            else "linux_amd64";

          src = pkgs.fetchurl {
            url = "https://github.com/replicatedhq/replicated/releases/download/v${version}/replicated_${version}_${platform}.tar.gz";
            sha256 = {
              "darwin_all" = "sha256-QF9S45DL2n/380tOjWEYiZvI9LFe8LPCTJA49DnMPNE=";
              "linux_amd64" = "sha256-yfjaWE4rdvNYZ8qF6AIZGeyvHQOXTUUWJJjJCPHP24w=";
              "linux_arm64" = "sha256-it0yUgw3pzzHAy2slGaGhrVFcqxfr6TVZLotbMDdTSM=";
            }."${platform}";
          };

          sourceRoot = ".";
          dontUnpack = true;

          installPhase = ''
            runHook preInstall
            mkdir -p $out/bin
            tar -xzf $src -C $out/bin
            chmod +x $out/bin/replicated
            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Replicated CLI for managing releases";
            homepage = "https://www.replicated.com/";
            platforms = platforms.unix;
          };
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            # Languages
            go
            pkgs.nodejs_22

            # Kubernetes / Helm
            pkgs.kubernetes-helm
            pkgs.kubectl

            # Database
            pkgs.postgresql
            schemahero

            # Replicated
            replicated

            # Build tools
            pkgs.gnumake
            pkgs.git
            pkgs.jq

            # Container tools (optional, uses system docker)
            # pkgs.docker  # Usually provided by Docker Desktop
          ];

          shellHook = ''
            echo ""
            echo "⚓ Chartsmith development environment"
            echo ""
            echo "Languages:"
            echo "  Go       $(go version | cut -d' ' -f3)"
            echo "  Node.js  $(node --version)"
            echo ""
            echo "Tools:"
            echo "  helm        $(helm version --short 2>/dev/null || echo 'installed')"
            echo "  kubectl     $(kubectl version --client -o json 2>/dev/null | jq -r '.clientVersion.gitVersion' || echo 'installed')"
            echo "  schemahero  $(schemahero version 2>/dev/null || echo 'installed')"
            echo "  replicated  $(replicated version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo 'installed')"
            echo "  psql        $(psql --version | cut -d' ' -f3)"
            echo ""
            echo "Run 'make' to see available commands."
            echo "See CONTRIBUTING.md for setup instructions."
            echo ""
          '';
        };

        packages = {
          inherit schemahero replicated;
          default = schemahero;
        };
      });
}
