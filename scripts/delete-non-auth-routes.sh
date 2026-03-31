#!/bin/bash
# Delete all non-NextAuth API routes

cd "$(dirname "$0")/.."

# Find all route.ts files except NextAuth routes
find src/app/api -type f -name "route.ts" | grep -v "auth" | while read file; do
  echo "Deleting: $file"
  rm -f "$file"
done

# Also delete empty directories (except auth)
find src/app/api -type d -empty | grep -v "auth" | while read dir; do
  echo "Removing empty directory: $dir"
  rmdir "$dir" 2>/dev/null || true
done

echo "Done. Remaining routes:"
find src/app/api -type f -name "route.ts" | sort
