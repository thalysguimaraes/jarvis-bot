FROM node:20

WORKDIR /app

# Copy package files and tsconfig
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies including dev (force it)
RUN npm install --production=false

# Copy source code
COPY . .

# Build TypeScript using npx
RUN npx tsc

# Create auth directory
RUN mkdir -p auth_info

# Expose port
EXPOSE 3000

# Start the service
CMD ["node", "dist/index.js"]