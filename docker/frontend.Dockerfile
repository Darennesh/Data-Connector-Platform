FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
