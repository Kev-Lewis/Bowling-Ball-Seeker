# Matching Strategy

Retailer listings may not use the exact same name as official manufacturer product pages. Bowling Ball Seeker will use confidence scoring to match retailer listings to official ball records.

## Match Signals

- Brand match
- Name similarity
- Coverstock name
- Coverstock type
- Core name
- RG
- Differential
- MB/asym differential
- Factory finish

## Confidence Levels

- 95-100: Auto-match
- 80-94: Likely match, flag for review
- 60-79: Possible match, manual review required
- Below 60: Reject

## Notes

The system should not rely on name matching alone. Official manufacturer specs should be used to confirm whether a retailer listing is actually the same ball.