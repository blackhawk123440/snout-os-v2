#!/bin/bash
echo "Checking NEXTAUTH_URL for hidden characters..."
RESPONSE=$(curl -s https://snout-os-staging.onrender.com/api/auth/health)
URL=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['env']['NEXTAUTH_URL_RAW'])" 2>/dev/null)

if [ -z "$URL" ]; then
  echo "❌ Could not fetch URL"
  exit 1
fi

echo "URL: $URL"
echo "Length: ${#URL} (should be 37)"
echo "Last 5 bytes (hex): $(echo -n "$URL" | tail -c 5 | xxd -p | tr -d '\n')"
echo "Last 5 bytes (repr): $(echo -n "$URL" | tail -c 5 | python3 -c "import sys; print(repr(sys.stdin.read()))")"

if echo "$URL" | grep -q $'\n'; then
  echo "❌ Contains newline (\\n)"
elif echo "$URL" | grep -q $'\r'; then
  echo "❌ Contains carriage return (\\r)"
elif [ "${#URL}" -eq 37 ]; then
  echo "✅ URL is clean (length 37, no newlines)"
else
  echo "⚠️  URL length is ${#URL}, expected 37"
fi
