FROM node:24.5-slim AS build

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

COPY --from=build /app/nginx.template.conf /etc/nginx/nginx.template.conf

CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js && \
envsubst < /usr/share/nginx/html/sorobansecurityportal/env.template.js > /usr/share/nginx/html/sorobansecurityportal/env.js && \
sed -i \"s|BASE_PATH: ''|BASE_PATH: '/sorobansecurityportal'|g\" /usr/share/nginx/html/sorobansecurityportal/env.js && \
export OG_API_UPSTREAM=\"${OG_API_UPSTREAM:-127.0.0.1:8080}\" && \
export DEVTOOLS_UPSTREAM=\"${DEVTOOLS_UPSTREAM:-127.0.0.1:8787}\" && \
envsubst '${OG_API_UPSTREAM} ${DEVTOOLS_UPSTREAM}' < /etc/nginx/nginx.template.conf > /etc/nginx/nginx.conf && \
exec nginx -g 'daemon off;'"]

EXPOSE 80