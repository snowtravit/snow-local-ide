FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine
ENV HOME=/tmp DOTNET_CLI_HOME=/tmp DOTNET_NOLOGO=1 DOTNET_CLI_TELEMETRY_OPTOUT=1
WORKDIR /code
RUN printf '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings></PropertyGroup></Project>\n' > app.csproj \
    && printf '<configuration><packageSources><clear /></packageSources></configuration>\n' > NuGet.Config \
    && chown -R nobody:nobody /code
USER nobody
