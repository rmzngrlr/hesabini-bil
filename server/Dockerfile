# Use Node.js alpine image for a smaller footprint
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Expose backend port
EXPOSE 3005

# Start the application using the compiled JavaScript
CMD ["npm", "run", "serve"]
