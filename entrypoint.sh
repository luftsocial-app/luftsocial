#!/bin/sh
# Run TypeORM migrations
npm run typeorm -- migration:run -d src/database/migrations/config/typeorm.config.ts

# Start the main application
node src/main.js
