# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /code
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then \
      cat /etc/ssl/certs/ca-certificates.crt /run/secrets/proxy_ca > /tmp/build-ca.pem; \
      PIP_CERT=/tmp/build-ca.pem pip install --no-cache-dir numpy pandas requests; \
      result=$?; rm /tmp/build-ca.pem; exit "$result"; \
    else \
      pip install --no-cache-dir numpy pandas requests; \
    fi
RUN chown nobody:nogroup /code
USER nobody
