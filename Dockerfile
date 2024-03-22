FROM etherpad/etherpad:2

USER root

COPY . /tmp/ep_weave
RUN cd /tmp/ep_weave \
    && ls -la /tmp/ep_weave \
    && npm pack

# ep_search
RUN git clone -b feature/search-engine-ep2 https://github.com/yacchin1205/ep_search.git /tmp/ep_search \
    && cd /tmp/ep_search \
    && ls -la /tmp/ep_search \
    && npm pack

USER etherpad

ARG ETHERPAD_PLUGINS="ep_align ep_markdown ep_embedded_hyperlinks2 ep_font_color ep_headings2  ep_image_upload ep_openid_connect ep_oauth2"
ARG ETHERPAD_LOCAL_PLUGINS="/tmp/ep_weave/ /tmp/ep_search/"
RUN bin/installDeps.sh && rm -rf ~/.npm && \
    if [ ! -z "${ETHERPAD_PLUGINS}" ]; then \
        pnpm run install-plugins ${ETHERPAD_PLUGINS}; \
    fi && \
    if [ ! -z "${ETHERPAD_LOCAL_PLUGINS}" ]; then \
        pnpm run install-plugins ${ETHERPAD_LOCAL_PLUGINS:+--path ${ETHERPAD_LOCAL_PLUGINS}}; \
    fi
