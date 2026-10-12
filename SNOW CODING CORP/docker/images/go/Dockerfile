FROM golang:1.25-alpine
ENV HOME=/tmp GOCACHE=/go/cache GOPATH=/go GO111MODULE=off
WORKDIR /code
RUN printf 'package main\nimport "fmt"\nfunc main() { fmt.Println("warmup") }\n' > /tmp/warmup.go \
    && go build -o /tmp/warmup /tmp/warmup.go \
    && rm /tmp/warmup /tmp/warmup.go \
    && chown -R nobody:nobody /code /go
USER nobody
