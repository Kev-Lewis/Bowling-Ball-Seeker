# Data Sources

## Manufacturer Sources

Manufacturer websites are used to determine official product identity, current lineup status, and ball specifications.

Manufacturer data may include:

- Ball name
- Brand
- Product line
- Coverstock name
- Coverstock type
- Core name
- Core type
- Factory finish
- RG
- Differential
- MB/asym differential
- Official product URL
- Product image
- Current lineup status

## Retailer Sources

Retailer and marketplace websites are used to track pricing and availability.

Retailer data may include:

- Listing title
- Retailer name
- Product URL
- Current price
- Sale price
- Stock status
- Condition
- Last checked timestamp

## Source Rules

- Manufacturer data is treated as the source of truth for ball identity.
- Retailer listings must be matched back to official manufacturer records.
- Marketplace listings are separated from verified retailer listings.