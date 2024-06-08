FROM mcr.microsoft.com/devcontainers/typescript-node:18 AS build-stage

COPY . /app/ep_weave
RUN cd /app/ep_weave \
    && ls -la /app/ep_weave \
    && npm i --include dev && npm run build

FROM etherpad/etherpad:2

USER root

COPY --from=build-stage /app/ep_weave /tmp/ep_weave

# ep_search
RUN git clone -b feature/search-engine-ep2 https://github.com/yacchin1205/ep_search.git /tmp/ep_search \
    && cd /tmp/ep_search \
    && ls -la /tmp/ep_search \
    && npm pack

USER etherpad

ARG ETHERPAD_PLUGINS="ep_align ep_markdown ep_embedded_hyperlinks2 ep_font_color ep_headings2  ep_image_upload"
ARG ETHERPAD_LOCAL_PLUGINS="/tmp/ep_weave/ /tmp/ep_search/"
RUN bin/installDeps.sh && rm -rf ~/.npm && \
    if [ ! -z "${ETHERPAD_PLUGINS}" ]; then \
        pnpm run plugins i ${ETHERPAD_PLUGINS}; \
    fi && \
    if [ ! -z "${ETHERPAD_LOCAL_PLUGINS}" ]; then \
        pnpm run plugins i ${ETHERPAD_LOCAL_PLUGINS:+--path ${ETHERPAD_LOCAL_PLUGINS}}; \
    fi

# If you don't want to use the OpenID Connect plugin, you can comment out the following line.
RUN pnpm run plugins i ep_openid_connect ep_user_displayname ep_stable_authorid
