{
  description = "Chartsmith development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        schemahero = pkgs.stdenv.mkDerivation rec {
          pname = "schemahero";
          version = "0.23.0-beta.2";

          src = pkgs.fetchurl {
            url = "https://github.com/schemahero/schemahero/releases/download/v${version}/kubectl-schemahero_${
              if pkgs.stdenv.isDarwin then "darwin" else "linux"
            }_${
              if pkgs.stdenv.isAarch64 then "arm64" else "amd64"
            }";
            sha256 = "sha256-ABnfxLMtY8E5KqJkrtIlPB4ML7CSFvjiLCabu/uLtJU=";
          };

          dontUnpack = true;
          dontBuild = true;

          installPhase = ''
            mkdir -p $out/bin
            cp ${src} $out/bin/schemahero
            chmod +x $out/bin/schemahero
          '';

          meta = with pkgs.lib; {
            description = "Declarative database schema management";
            homepage = "https://schemahero.io/";
            platforms = platforms.unix;
          };
        };

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Core tools
            go_1_24
            nodejs_18
            nodePackages.npm
            
            # Database tools
            schemahero
            postgresql
            
            # Container tools
            docker
            
            # Other utilities
            git
            gnumake
            jq
          ];

          shellHook = ''
            echo "Chartsmith development environment loaded!"
            echo ""
            echo "Available tools:"
            echo "  - Go $(go version | cut -d' ' -f3)"
            echo "  - Node.js $(node --version)"
            echo "  - npm $(npm --version)"
            echo "  - schemahero $(schemahero version 2>/dev/null || echo 'installed')"
            echo "  - PostgreSQL client $(psql --version | cut -d' ' -f3)"
            echo ""
            echo "See CONTRIBUTING.md for setup instructions."
          '';
        };

        packages = {
          inherit schemahero;
          default = schemahero;
        };
      }
    );
}
