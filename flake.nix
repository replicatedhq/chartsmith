{
  description = "Chartsmith development environment";

  outputs = { self, nixpkgs }:
    let
      forAllSystems = f: {
        x86_64-darwin = f "x86_64-darwin";
        aarch64-darwin = f "aarch64-darwin";
        x86_64-linux = f "x86_64-linux";
        aarch64-linux = f "aarch64-linux";
      };
      
      mkSchemahero = pkgs: pkgs.stdenv.mkDerivation rec {
        pname = "schemahero";
        version = "0.23.0-beta.4";

        src = pkgs.fetchurl {
          url = "https://github.com/schemahero/schemahero/releases/download/v${version}/kubectl-schemahero_${
            if pkgs.stdenv.isDarwin then "darwin" else "linux"
          }_${
            if pkgs.stdenv.isAarch64 then "arm64" else "amd64"
          }.tar.gz";
          sha256 = if pkgs.stdenv.isDarwin then
            (if pkgs.stdenv.isAarch64 then
              "sha256-fobkan9sgNyCouI6pq+29Xdj7CcgkyguH+0b1CKCWow="
            else
              "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
          else
            (if pkgs.stdenv.isAarch64 then
              "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
            else
              "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
        };

        sourceRoot = ".";

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

      mkReplicated = pkgs: pkgs.stdenv.mkDerivation rec {
        pname = "replicated";
        version = "0.124.0";

        src = pkgs.fetchurl {
          url = "https://github.com/replicatedhq/replicated/releases/download/v${version}/replicated_${version}_${
            if pkgs.stdenv.isDarwin then "darwin_all" else (
              if pkgs.stdenv.isAarch64 then "linux_arm64" else "linux_amd64"
            )
          }.tar.gz";
          sha256 = if pkgs.stdenv.isDarwin then
            "sha256-QF9S45DL2n/380tOjWEYiZvI9LFe8LPCTJA49DnMPNE="
          else
            (if pkgs.stdenv.isAarch64 then
              "sha256-itoyUiDDenPMxwMtrJRmhodUVyrF+vpNVkui3M3Q1CM="
            else
              "sha256-yfjahYSydvNYZ8qFjgIRkZ7K8dA5dNRRJJSMkI8c+8w=");
        };

        sourceRoot = ".";

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
    in {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          schemahero = mkSchemahero pkgs;
          replicated = mkReplicated pkgs;
        in {
          default = pkgs.mkShell {
            buildInputs = [
              schemahero
              replicated
              pkgs.nodejs
              pkgs.docker
              pkgs.git
              pkgs.gnumake
              pkgs.postgresql
              pkgs.jq
            ];

            shellHook = ''
              echo "Chartsmith development environment loaded!"
              echo ""
              echo "Available tools:"
              echo "  ✅ Go $(go version 2>/dev/null | cut -d' ' -f3 || echo 'using system Go')"
              echo "  ✅ Node.js $(node --version)"
              echo "  ✅ schemahero $(schemahero version 2>/dev/null || echo 'installed')"
              echo "  ✅ replicated $(replicated version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo 'installed')"
              echo "  ✅ PostgreSQL client $(psql --version | cut -d' ' -f3)"
              echo "  ✅ Docker $(docker --version 2>/dev/null | cut -d' ' -f3 || echo 'not running')"
              echo "  ✅ Git $(git --version | cut -d' ' -f3)"
              echo ""
              echo "See CONTRIBUTING.md for setup instructions."
            '';
          };
        });

      packages = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          schemahero = mkSchemahero pkgs;
          replicated = mkReplicated pkgs;
        in {
          inherit schemahero replicated;
          default = schemahero;
        });
    };
}
