# ── Stage 1: base runtime (Node + opencode pre-installed) ───────────────────
# Mirrors Backend/Dockerfile base-image conventions:
#   mcr.microsoft.com/dotnet/aspnet:10.0 (runtime)  +  Node 20 + opencode CLI
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app

# Install Node.js 20 (same as API Dockerfile) + opencode-ai CLI.
# opencode needs to be on PATH for the worker process to shell out to it.
RUN apt-get update && \
    apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest opencode-ai && \
    rm -rf /var/lib/apt/lists/*

# HOME is set here and overridden in the Helm Deployment via env so that
# opencode can find its mounted auth.json at $HOME/.local/share/opencode/auth.json.
ENV HOME=/home/worker
ENV PATH="${PATH}:/usr/local/bin"

# ── Stage 2: SDK build ───────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Restore dependencies for the worker project only.
# (The worker has no dependency on SorobanSecurityPortalApi — it is intentionally decoupled.)
COPY ["AgentIngestionWorker/AgentIngestionWorker.csproj", "AgentIngestionWorker/"]
RUN dotnet restore "AgentIngestionWorker/AgentIngestionWorker.csproj"

# Copy all sources and build.
COPY . .
WORKDIR "/src/AgentIngestionWorker"
RUN dotnet build "AgentIngestionWorker.csproj" -c $BUILD_CONFIGURATION -o /app/build

# ── Stage 3: publish ─────────────────────────────────────────────────────────
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "AgentIngestionWorker.csproj" -c $BUILD_CONFIGURATION -o /app/publish

# ── Stage 4: final runtime image ─────────────────────────────────────────────
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "AgentIngestionWorker.dll"]
