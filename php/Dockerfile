FROM phpdockerio/php7-fpm:latest

# Install selected extensions and other stuff
RUN apt-get update \
    && apt-get -y --no-install-recommends install  php7.0-mongodb \
    && apt-get clean; rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /usr/share/doc/*

COPY php-ini-overrides.ini /etc/php/7.0/fpm/conf.d/99-overrides.ini
COPY web/* /var/www/web/

WORKDIR "/var/www/web"
