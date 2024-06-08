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

ARG ETHERPAD_PLUGINS="ep_align ep_markdown ep_embedded_hyperlinks2 ep_font_color ep_headings2  ep_image_upload ep_openid_connect ep_user_displayname"
ARG ETHERPAD_LOCAL_PLUGINS="/tmp/ep_weave/ /tmp/ep_search/"
RUN bin/installDeps.sh && rm -rf ~/.npm && \
    if [ ! -z "${ETHERPAD_PLUGINS}" ]; then \
        pnpm run install-plugins ${ETHERPAD_PLUGINS}; \
    fi && \
    if [ ! -z "${ETHERPAD_LOCAL_PLUGINS}" ]; then \
        pnpm run install-plugins ${ETHERPAD_LOCAL_PLUGINS:+--path ${ETHERPAD_LOCAL_PLUGINS}}; \
    fi
