# Notebook Search

## Configuration

Add to `settings.json`:

```json
{
  "ep_weave": {
    "notebookSearch": {
      "baseUrl": "https://solr-server:8983",
      "core": "jupyter-cell",
      "username": "optional",
      "password": "optional",
      "jupyterBaseUrl": "https://jupyter.example.com/user/username"
    }
  }
}
```

- `baseUrl` (required): Solr server URL
- `core` (optional): Solr core name, default: "jupyter-cell"
- `username`/`password` (optional): Basic authentication
- `jupyterBaseUrl` (optional): Jupyter server base URL for notebook links

## Features

- Searches Jupyter notebook markdown headings (`source__markdown__heading` field)
- Displays results in Rollup area under "Notebooks with this keyword in headings"
- Shows: filename, heading text, cell number, modification date

## API

`GET /ep_weave/notebook-search`

Query parameters:
- `query` or `q`: Search keyword
- `start`: Offset (default: 0)
- `limit`: Result count (default: 60)
- `sort`: Sort order (default: "notebook_mtime desc")

## Behavior

- If not configured: endpoint returns 404, no UI section shown
- If configured: searches Solr and displays results in Rollup

## Notes

- Notebook links use nbsearch plugin with `lc_cell_meme__current` field to highlight specific cells
- Links are only generated when `jupyterBaseUrl` is configured