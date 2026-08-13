FROM node:22-slim
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public
ENV NODE_ENV=production
EXPOSE 3100
CMD ["node", "src/server.js"]
