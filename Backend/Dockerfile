FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

RUN apt-get update && \
    apt-get install -y python3.11 python3-pip ffmpeg curl gnupg && \
    rm -rf /var/lib/apt/lists/*
	
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest

ENV PLAYWRIGHT_NODEJS_PATH=/usr/bin/node
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build

ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj", "SorobanSecurityPortalApi/"]
RUN dotnet restore "SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj"
COPY . .
WORKDIR "/src/SorobanSecurityPortalApi"
RUN dotnet build "SorobanSecurityPortalApi.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "SorobanSecurityPortalApi.csproj" -c $BUILD_CONFIGURATION -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SorobanSecurityPortalApi.dll"]