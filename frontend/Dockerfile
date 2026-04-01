# ==========================================
# Stage 1: Build Frontend (Node.js)
# ==========================================
FROM node:24-alpine AS build
WORKDIR /app

# Copy package files strictly first
COPY package.json package-lock.json ./

# Install dependencies using `npm ci` for consistency
RUN npm ci

# Copy all source files
COPY . .

# Build the app to the dist/ directory via Vite
RUN npm run build

# ==========================================
# Stage 2: Serve with Nginx
# ==========================================
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build files from Stage 1 to Nginx HTML directory
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
