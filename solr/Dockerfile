FROM solr:9-slim

USER root

COPY . /tmp/ep_weave
RUN mkdir /opt/ep_weave \
    && mv /tmp/ep_weave/solr /opt/ep_weave/ \
    && chmod -R a+rX /opt/ep_weave/solr

USER solr

CMD ["solr-precreate", "pad", "/opt/ep_weave/solr/pad"]
