FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm install

COPY . .

RUN npm run build

# Standalone needs static + public assets copied manually
RUN cp -r .next/static .next/standalone/.next/static || true
RUN cp -r public .next/standalone/public || true

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

CMD ["node", ".next/standalone/server.js"]
