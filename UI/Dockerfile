FROM node:24.5 AS build

WORKDIR /app
COPY package*.json ./

RUN npm install --force

COPY . .

RUN npm run build

FROM nginx:alpine

# root path
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/env.template.js /usr/share/nginx/html/env.template.js

# /sorobansecurityportal path
COPY --from=build /app/dist_sorobansecurityportal /usr/share/nginx/html/sorobansecurityportal
COPY --from=build /app/env.template.js /usr/share/nginx/html/sorobansecurityportal/env.template.js

COPY --from=build /app/nginx.conf /etc/nginx/nginx.conf

CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js && \
envsubst < /usr/share/nginx/html/sorobansecurityportal/env.template.js > /usr/share/nginx/html/sorobansecurityportal/env.js && \
sed -i \"s|BASE_PATH: ''|BASE_PATH: '/sorobansecurityportal'|g\" /usr/share/nginx/html/sorobansecurityportal/env.js && \
exec nginx -g 'daemon off;'"]

EXPOSE 80