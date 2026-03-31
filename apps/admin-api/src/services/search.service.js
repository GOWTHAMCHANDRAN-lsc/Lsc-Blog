const logger = require('../config/logger');

let esClient = null;

// Only initialize Elasticsearch if configured
if (process.env.ELASTICSEARCH_URL) {
  try {
    const { Client } = require('@elastic/elasticsearch');
    esClient = new Client({ node: process.env.ELASTICSEARCH_URL });
    logger.info('Elasticsearch client initialized');
  } catch (err) {
    logger.warn(
      'Elasticsearch not available, falling back to MySQL full-text search'
    );
  }
}

const INDEX = 'blog_posts';

class SearchService {
  async indexPost(
    postId,
    { tenantId, title, content, slug, excerpt = '', tags = [], categories = [] }
  ) {
    if (!esClient) return; // graceful fallback

    try {
      await esClient.index({
        index: INDEX,
        id: postId,
        document: {
          tenant_id: tenantId,
          title,
          content: content.substring(0, 10000), // limit content size
          excerpt,
          slug,
          tags,
          categories,
          indexed_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      logger.error('Elasticsearch index error:', err.message);
    }
  }

  async deletePost(postId) {
    if (!esClient) return;
    try {
      await esClient.delete({ index: INDEX, id: postId });
    } catch (err) {
      if (err.statusCode !== 404) logger.error('ES delete error:', err.message);
    }
  }

  async search(tenantId, query, { page = 1, perPage = 10 } = {}) {
    if (!esClient) return null; // signal caller to use MySQL fallback

    try {
      const result = await esClient.search({
        index: INDEX,
        from: (page - 1) * perPage,
        size: perPage,
        query: {
          bool: {
            must: [
              { term: { tenant_id: tenantId } },
              {
                multi_match: {
                  query,
                  fields: [
                    'title^3',
                    'tags^2',
                    'categories^2',
                    'excerpt^1.5',
                    'content',
                  ],
                  fuzziness: 'AUTO',
                  operator: 'or',
                },
              },
            ],
          },
        },
        highlight: {
          fields: {
            title: { number_of_fragments: 0 },
            content: { fragment_size: 200, number_of_fragments: 1 },
          },
        },
      });

      return {
        hits: result.hits.hits.map(h => ({
          id: h._id,
          score: h._score,
          ...h._source,
          highlights: h.highlight,
        })),
        total: result.hits.total.value,
      };
    } catch (err) {
      logger.error('Elasticsearch search error:', err.message);
      return null;
    }
  }

  async createIndex() {
    if (!esClient) return;
    try {
      const exists = await esClient.indices.exists({ index: INDEX });
      if (!exists) {
        await esClient.indices.create({
          index: INDEX,
          mappings: {
            properties: {
              tenant_id: { type: 'keyword' },
              title: { type: 'text', analyzer: 'english' },
              content: { type: 'text', analyzer: 'english' },
              excerpt: { type: 'text' },
              slug: { type: 'keyword' },
              tags: { type: 'keyword' },
              categories: { type: 'keyword' },
              indexed_at: { type: 'date' },
            },
          },
        });
        logger.info('Elasticsearch index created');
      }
    } catch (err) {
      logger.error('ES createIndex error:', err.message);
    }
  }
}

module.exports = new SearchService();
