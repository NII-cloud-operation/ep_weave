![Publish Status](https://github.com/NII-cloud-operation/ep_weave/workflows/Node.js%20Package/badge.svg) ![Backend Tests Status](https://github.com/NII-cloud-operation/ep_weave/workflows/Backend%20tests/badge.svg)

# ep_weave

ep_weave is a plugin to use Etherpad like a wiki.

In this environment, you can easily link pages to each other by defining references to different pages using #hashtag s.
Also, the first line of text is handled as the title.
These mechanisms are inspired by Squeak Swiki https://wiki.squeak.org/squeak and Scrapbox https://scrapbox.io/.

# How to try

Use docker-compose to try ep_weave. Run the container as described below and access http://localhost:9001 .
Then click the [New Pad] button to create a new page.

```
docker compose build
docker compose up -d
```


