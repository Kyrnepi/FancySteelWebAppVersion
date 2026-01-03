# ===========================================
# Fancy Steel Web App Mode - Dockerfile
# Multi-stage build for production deployment
# ===========================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source
COPY frontend/ ./

# Build the React application
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000
ENV CONFIG_PATH=/config

# Copy backend package files
COPY backend/package*.json ./backend/

# Install production dependencies only
WORKDIR /app/backend
RUN npm install --omit=dev

# Copy backend source
COPY backend/src ./src

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create config directory
RUN mkdir -p /config

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /app /config

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Volume for persistent configuration
VOLUME ["/config"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start the server
CMD ["node", "src/server.js"]
