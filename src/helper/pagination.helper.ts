export function paginateAndSummarize(
  data: any,
  page: number,
  limit: number,
  statuses?: string[], // Accepts an array of statuses as a parameter
) {
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const paginatedItems = data.slice((page - 1) * limit, page * limit);

  const summary: Record<string, number> = {};

  return {
    data: paginatedItems,
    summary,
    pagination: {
      total,
      totalPages,
      currentPage: page,
      perPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
