/**
 * Build pagination metadata
 */
function paginate(total, page, perPage) {
  const totalPages = Math.ceil(total / perPage);
  return {
    page,
    per_page: perPage,
    total,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}

/**
 * Parse pagination params from request query with safe defaults
 */
function parsePagination(
  query,
  { defaultPerPage = 10, maxPerPage = 100 } = {}
) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const perPage = Math.min(
    maxPerPage,
    Math.max(1, parseInt(query.per_page) || defaultPerPage)
  );
  const offset = (page - 1) * perPage;
  return { page, perPage, offset };
}

module.exports = { paginate, parsePagination };
