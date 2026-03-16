# Build stage
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git gcc musl-dev

WORKDIR /src
RUN git clone https://git.sr.ht/~migadu/alps .

RUN go build ./cmd/alps

# Final stage
FROM alpine:latest

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /src/alps /usr/local/bin/alps
COPY --from=builder /src/themes /app/themes
COPY --from=builder /src/plugins /app/plugins

EXPOSE 80

ENTRYPOINT ["alps"]
CMD ["-addr", "0.0.0.0:80", "imap://maddy:143", "smtps://maddy:587"]
