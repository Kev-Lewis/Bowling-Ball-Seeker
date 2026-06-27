export function parseUrlList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

export function getBowlingComProductUrlsFromEnv() {
  return parseUrlList(process.env.BOWLING_COM_PRODUCT_URLS);
}