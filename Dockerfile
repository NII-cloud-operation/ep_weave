ARG ETHERPAD_IMAGE_NAME="etherpad/etherpad"
ARG ETHERPAD_IMAGE_TAG="2"

FROM mcr.microsoft.com/devcontainers/typescript-node:18 AS build-stage

COPY . /app/ep_weave
RUN cd /app/ep_weave \
    && ls -la /app/ep_weave \
    && npm i --include dev && npm run build

FROM ${ETHERPAD_IMAGE_NAME}:${ETHERPAD_IMAGE_TAG}

USER root

COPY --from=build-stage /app/ep_weave /tmp/ep_weave

# ep_search
RUN git clone -b feature/search-engine https://github.com/NII-cloud-operation/ep_search.git /tmp/ep_search \
    && cd /tmp/ep_search \
    && ls -la /tmp/ep_search \
    && npm pack

# ep_webrtc
RUN git clone -b feature/sfu https://github.com/NII-cloud-operation/ep_webrtc.git /tmp/ep_webrtc \
    && cd /tmp/ep_webrtc \
    && ls -la /tmp/ep_webrtc \
    && npm pack

USER etherpad

ARG ETHERPAD_PLUGINS="ep_align ep_markdown ep_embedded_hyperlinks2 ep_font_color ep_headings2  ep_image_upload"
ARG ETHERPAD_LOCAL_PLUGINS="/tmp/ep_weave/ /tmp/ep_search/ /tmp/ep_webrtc/"
RUN bin/installDeps.sh && rm -rf ~/.npm && \
    if [ ! -z "${ETHERPAD_PLUGINS}" ]; then \
        pnpm run plugins i ${ETHERPAD_PLUGINS}; \
    fi && \
    if [ ! -z "${ETHERPAD_LOCAL_PLUGINS}" ]; then \
        pnpm run plugins i ${ETHERPAD_LOCAL_PLUGINS:+--path ${ETHERPAD_LOCAL_PLUGINS}}; \
    fi

# If you don't want to use the OpenID Connect plugin, you can comment out the following line.
RUN pnpm run plugins i ep_openid_connect@3.0.7 ep_user_displayname ep_stable_authorid
