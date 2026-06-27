import { prisma } from "../db/prisma";
import type { MatchStatus } from "../types/ball";

export interface ListingMatchCandidate {
  ballId: string;
  canonicalName: string;
  brand: string;
  manufacturer: string;
  coverstockName: string | null;
  coverstockType: string;
  coreName: string | null;
  coreType: string;
  confidence: number;
  matchStatus: MatchStatus;
  reasons: string[];
}

export interface ListingMatchOptions {
  limit?: number;
  minConfidence?: number;
  includeRejected?: boolean;
  currentOnly?: boolean;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCatalogNameForMatching(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/\s+bowling balls for sale$/g, "")
    .replace(/\s+bowling ball for sale$/g, "")
    .replace(/\s+balls for sale$/g, "")
    .replace(/\s+ball for sale$/g, "")
    .replace(/\s+for sale$/g, "")
    .replace(/\s+bowling balls$/g, "")
    .replace(/\s+bowling ball$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  const ignoredTokens = new Set([
    "bowling",
    "ball",
    "balls",
    "new",
    "brand",
    "lb",
    "lbs",
    "pound",
    "pounds",
    "undrilled",
    "drilled",
    "single",
    "limited",
    "edition",

    // Color words: keep exact phrase matching, but avoid weak partial matches
    // like "Aspire Purple/Silver/Black" matching "Black Venom".
    "black",
    "white",
    "red",
    "blue",
    "green",
    "purple",
    "silver",
    "gold",
    "gray",
    "grey",
    "orange",
    "yellow",
    "pink",
    "navy",
    "teal",
    "aqua",
    "lime",
    "berry",
    "scarlet",
    "smoke",
    "royal",
    "sky",
    "tangerine",
    "lavender",
    "ocean",
    "carbon",
    "cobalt",
  ]);

  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => !ignoredTokens.has(token));
}

function uniqueTokens(value: string) {
  return [...new Set(tokenize(value))];
}

function hasPhrase(haystack: string, needle: string | null | undefined) {
  const normalizedNeedle = normalizeText(needle);

  if (!normalizedNeedle) {
    return false;
  }

  return haystack.includes(normalizedNeedle);
}

function tokenCoverage(titleTokens: string[], targetText: string) {
  const targetTokens = uniqueTokens(targetText);

  if (targetTokens.length === 0) {
    return 0;
  }

  const matchedCount = targetTokens.filter((token) => {
    return titleTokens.includes(token);
  }).length;

  return matchedCount / targetTokens.length;
}

function statusFromConfidence(confidence: number): MatchStatus {
  if (confidence >= 85) {
    return "auto_matched";
  }

  if (confidence >= 65) {
    return "likely_match";
  }

  if (confidence >= 35) {
    return "manual_review";
  }

  return "rejected";
}

export async function matchRetailerListingTitle(
  listingTitle: string,
  options: ListingMatchOptions = {}
) {
  const limit = options.limit ?? 10;
  const minConfidence = options.minConfidence ?? 35;
  const includeRejected = options.includeRejected ?? false;
  const currentOnly = options.currentOnly ?? true;

  const normalizedTitle = normalizeText(listingTitle);
  const titleTokens = uniqueTokens(listingTitle);

  const balls = await prisma.ball.findMany({
    where: currentOnly
      ? {
          isCurrent: true,
        }
      : {},
    orderBy: [{ brand: "asc" }, { canonicalName: "asc" }],
  });

  const allCandidates: ListingMatchCandidate[] = balls
    .map((ball) => {
      let score = 0;
      const reasons: string[] = [];

      const matchableCanonicalName = cleanCatalogNameForMatching(
        ball.canonicalName
      );

      if (hasPhrase(normalizedTitle, matchableCanonicalName)) {
        score += 70;
        reasons.push("Official ball name appears in listing title.");
      } else {
        const matchableNameTokens = tokenize(matchableCanonicalName);
        const nameCoverage = tokenCoverage(titleTokens, matchableCanonicalName);

        if (matchableNameTokens.length >= 2 && nameCoverage > 0) {
          const points = Math.round(nameCoverage * 45);
          score += points;
          reasons.push(
            `Official ball name token coverage: ${Math.round(
              nameCoverage * 100
            )}%.`
          );
        }
      }

      if (hasPhrase(normalizedTitle, ball.brand)) {
        score += 20;
        reasons.push("Brand appears in listing title.");
      }

      if (ball.coreName && hasPhrase(normalizedTitle, ball.coreName)) {
        score += 10;
        reasons.push("Core name appears in listing title.");
      }

      if (
        ball.coverstockName &&
        tokenCoverage(titleTokens, ball.coverstockName) >= 0.5
      ) {
        score += 8;
        reasons.push("Coverstock name partially matches listing title.");
      }

      if (
        ball.coverstockType !== "unknown" &&
        titleTokens.includes(ball.coverstockType)
      ) {
        score += 5;
        reasons.push("Coverstock type appears in listing title.");
      }

      if (ball.coreType !== "unknown" && titleTokens.includes(ball.coreType)) {
        score += 5;
        reasons.push("Core type appears in listing title.");
      }

      const confidence = Math.min(score, 100);

      return {
        ballId: ball.id,
        canonicalName: ball.canonicalName,
        brand: ball.brand,
        manufacturer: ball.manufacturer,
        coverstockName: ball.coverstockName,
        coverstockType: ball.coverstockType,
        coreName: ball.coreName,
        coreType: ball.coreType,
        confidence,
        matchStatus: statusFromConfidence(confidence),
        reasons,
      };
    })
    .filter((candidate) => {
      if (candidate.confidence <= 0) {
        return false;
      }

      if (includeRejected) {
        return true;
      }

      return (
        candidate.matchStatus !== "rejected" &&
        candidate.confidence >= minConfidence
      );
    })
    .sort((a, b) => {
      return b.confidence - a.confidence;
    });

  const candidates = allCandidates.slice(0, limit);

  return {
    listingTitle,
    normalizedTitle,
    filters: {
      limit,
      minConfidence,
      includeRejected,
      currentOnly,
    },
    count: candidates.length,
    data: candidates,
    generatedAt: new Date().toISOString(),
  };
}