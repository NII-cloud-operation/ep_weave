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

# Configuration

You can configure the following settings in settings.json.

```
  "ep_weave": {
    "basePath": "/ep_weave",
    "initialPadsPath": "/pads.d"
  }
```

- basePath: The base path of the etherpad. The default is "". If you deploy Etherpad to a subdirectory, set the subdirectory path.
- initialPadsPath: The path to the initial pads. The default is "". When a path is set, the plugin will create an initial pad from the files in the directory specified by this path when the server is initialized. The file must be a JSON file with the `.etherpad` extension that has been exported from Etherpad.
