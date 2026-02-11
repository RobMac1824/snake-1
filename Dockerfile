FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY public/ ./public/
COPY supabase/ ./supabase/

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
