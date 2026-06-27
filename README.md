# Bowling Ball Seeker

Bowling Ball Seeker is a U.S.-focused bowling ball price tracking platform.

The project tracks currently available bowling balls from official manufacturer websites, monitors trusted retailers and marketplaces for pricing, stores daily price history, detects ball lineup changes, and will support Discord bot commands and alerts.

## Goals

- Track current U.S.-available bowling balls.
- Pull official ball metadata from manufacturer websites.
- Track prices from trusted retailers and marketplaces.
- Store daily price snapshots.
- Track highest and lowest seen prices.
- Detect newly added and removed balls from manufacturer lineups.
- Match retailer listings to official manufacturer data using confidence scoring.
- Add Discord bot commands after core API functionality is complete.

## Planned Sources

### Manufacturer Sources

Used for official product truth:
- Storm
- Roto Grip
- 900 Global
- Motiv
- Hammer
- Brunswick
- Ebonite
- Track
- Radical
- Swag

### Retail / Marketplace Sources

Used for pricing:
- bowling.com
- buddiesproshop.com
- bowlersmart.com
- bowlingball.com
- bowlersparadise.com
- other verified bowling retailers

## Tech Stack

- Node.js
- TypeScript
- Express
- PostgreSQL or SQLite
- Discord bot
- React dashboard
- scheduled daily jobs