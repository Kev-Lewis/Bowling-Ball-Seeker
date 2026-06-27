export function toAbsoluteUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function removeTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function decodeSlugNameFromUrl(url: string) {
  const withoutQuery = url.split("?")[0];
  const lastPart = withoutQuery.split("/").filter(Boolean).pop() ?? "";

  return lastPart
    .replace(/\.html$/i, "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}