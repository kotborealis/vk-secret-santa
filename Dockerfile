FROM node:12-alpine

RUN mkdir -p /app
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENTRYPOINT node /app/index.js