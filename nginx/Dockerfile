# Dockerfile to run nginx for JKA demo site
FROM nginx:alpine
MAINTAINER Dan Padgett <dumbledore3@gmail.com>

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY web /var/www/web
