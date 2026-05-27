FROM solr:8

USER root

COPY . /tmp/ep_weave
RUN mkdir /opt/ep_weave \
    && mv /tmp/ep_weave/solr /opt/ep_weave/ \
    && chmod -R a+rX /opt/ep_weave/solr \
    && chmod 0755 /opt/ep_weave/solr/start.sh

USER solr

ENTRYPOINT /opt/ep_weave/solr/start.sh