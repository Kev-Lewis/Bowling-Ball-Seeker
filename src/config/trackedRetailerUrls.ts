export function parseUrlList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

export function parsePositiveInteger(
  value: string | undefined,
  fallback: number
) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getBowlingComProductUrlsFromEnv() {
  return parseUrlList(process.env.BOWLING_COM_PRODUCT_URLS);
}

export function getBowlingComCategoryUrlsFromEnv() {
  return parseUrlList(process.env.BOWLING_COM_CATEGORY_URLS);
}

export function getBowlingComCategoryMaxPagesFromEnv() {
  return parsePositiveInteger(process.env.BOWLING_COM_CATEGORY_MAX_PAGES, 1);
}

export function getBowlingComCategoryMaxProductsFromEnv() {
  return parsePositiveInteger(
    process.env.BOWLING_COM_CATEGORY_MAX_PRODUCTS,
    10
  );
}