FROM node:12.16.2-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production
RUN npm install -g pm2

COPY . .

EXPOSE 3000


ENTRYPOINT [ "pm2-runtime", "start", "/usr/src/app/ecosystem.config.js" ]

