# syntax=docker/dockerfile:1

# Stage 1: build the static frontend
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: build the Go binary
FROM golang:1.25-alpine AS backend
WORKDIR /src
COPY go/go.mod go/go.sum ./
RUN go mod download
COPY go/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /licht .

# Stage 3: minimal runtime image
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=backend /licht /app/licht
COPY --from=frontend /frontend/out /app/static
ENV FRONTEND_DIR=/app/static
ENV API_PORT=8080
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/app/licht"]
