FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

# https://github.com/supabase/cli/releases

ARG SUPABASE_CLI_VERSION=2.109.0 
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_${arch}.deb" -o /tmp/supabase.deb; \
    dpkg -i /tmp/supabase.deb; \
    rm /tmp/supabase.deb; \
    supabase --version
