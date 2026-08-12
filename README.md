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

## Notebook Search Integration

ep_weave can integrate with [nbsearch](https://github.com/NII-cloud-operation/nbsearch) to search Jupyter Notebooks by hashtags found in pads.

To configure notebook search, add the following settings:

```json
"ep_weave": {
  "notebookSearch": {
    "baseUrl": "http://localhost:8983",
    "core": "jupyter-cell",
    "username": "solr_username",
    "password": "solr_password",
    "jupyterBaseUrl": "https://jupyter.example.com/tree"
  }
}
```

- `baseUrl`: Solr server URL (required)
- `core`: Solr core name (default: "jupyter-cell")
- `username`: Basic auth username for Solr (optional)
- `password`: Basic auth password for Solr (optional)
- `jupyterBaseUrl`: Jupyter base URL for generating links (optional)

# Troubleshooting

## Search does not work / the top page shows no pads

Check the state of the Solr container:

```bash
docker compose ps solr
```

If it is `unhealthy`, the `pad` core has failed to load. This typically
happens when the Solr data volume was created by an older major version of
Solr (e.g. after upgrading ep_weave across the Solr 8 to 9 boundary): the
old index and core configuration cannot be loaded by the new version.

The index can be rebuilt from scratch because all pads are stored in the
Etherpad database. Remove the Solr data volume and restart both Solr and
Etherpad:

```bash
docker compose rm -sf solr
docker volume rm ep_weave_solr_data_vol
docker compose up -d
docker compose restart etherpad
```

ep_weave reindexes all pads at Etherpad startup when the index is empty.
Restarting Etherpad is required even if it is already running, because the
reindex only runs at startup. If search results are still incomplete
afterwards (e.g. the reindex was interrupted), repeat the same procedure.

# Development

## Testing with nbsearch

To test the notebook search integration locally, you can use the provided `docker-compose.nbsearch.yml` configuration which includes a full nbsearch environment.

### Setup

First, initialize the nbsearch submodule:

```bash
git submodule update --init --recursive
```

### Running with nbsearch

Start the environment with both ep_weave and nbsearch:

```bash
docker compose -f docker-compose.yml -f docker-compose.nbsearch.yml up -d
```

This will start:
- ep_weave (accessible at http://localhost:9001)
- nbsearch with Solr and test notebooks (JupyterLab at http://localhost:8888, Solr at http://localhost:8984)

The test notebooks in nbsearch contain hashtags that you can reference in your pads, and ep_weave will display matching notebooks in the sidebar.

### Stopping

```bash
docker compose -f docker-compose.yml -f docker-compose.nbsearch.yml down
```
