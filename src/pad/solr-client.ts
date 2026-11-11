
interface SolrClientConfig {
  baseUrl: string;
  core?: string;
  username?: string;
  password?: string;
}

interface SolrQuery {
  q: string;
  start?: number;
  rows?: number;
  sort?: string;
  fl?: string;
  fq?: string;
}

interface SolrResponse {
  response: {
    docs: any[];
    numFound: number;
    start: number;
    numFoundExact?: boolean;
  };
}

export function createClient(config: SolrClientConfig) {
  const { baseUrl, core = 'jupyter-cell' } = config;
  let authHeader: string | null = null;

  // Remove trailing slash from baseUrl if present
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const solrUrl = `${cleanBaseUrl}/solr/${core}`;

  return {
    basicAuth(username: string, password: string) {
      authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    },

    async search(query: SolrQuery): Promise<SolrResponse> {
      const params = new URLSearchParams({
        q: query.q,
        wt: 'json',
        start: (query.start || 0).toString(),
        rows: (query.rows || 10).toString(),
      });

      if (query.sort) {
        params.append('sort', query.sort);
      }
      if (query.fl) {
        params.append('fl', query.fl);
      }
      if (query.fq) {
        params.append('fq', query.fq);
      }

      const headers = new Headers({
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      if (authHeader) {
        headers.append('Authorization', authHeader);
      }

      // POST: a similarity query carries the whole query vector
      const url = `${solrUrl}/select`;
      console.debug('[ep_weave/solr-client] Solr request URL:', url);
      console.debug('[ep_weave/solr-client] Solr query:', query);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: params.toString(),
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error('[ep_weave/solr-client] Solr error response:', {
          status: response.status,
          statusText: response.statusText,
          url,
          responseBody: responseText,
        });
        throw new Error(`Solr search failed: ${response.status} ${response.statusText} - ${responseText}`);
      }

      return await response.json();
    },
  };
}