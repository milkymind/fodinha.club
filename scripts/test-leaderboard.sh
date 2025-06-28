#!/bin/bash

# Test script for the Real-Time Leaderboard functionality
# Tests the API endpoints and ensures data flows correctly

BASE_URL="http://localhost:3000"

echo "🚀 Starting Leaderboard Component Tests"
echo "=================================================="
echo ""

echo "🧪 Testing Leaderboard API Endpoints..."
echo ""

# Test each metric
metrics=("perfectPredictionRate" "avgSurvivalRate" "multiplierEfficiency" "lastPlayerWinRate" "highPressureAccuracy" "avgBetAccuracyScore")

for metric in "${metrics[@]}"; do
    echo "📊 Testing metric: $metric"
    
    # Test standard format
    response=$(curl -s "$BASE_URL/api/leaderboard-live?metric=$metric&limit=10")
    if echo "$response" | grep -q '"status":"success"'; then
        echo "  ✅ Standard format: Success"
    else
        echo "  ❌ Standard format: Failed"
        echo "     Response: $response"
    fi
    
    # Test comprehensive format
    response=$(curl -s "$BASE_URL/api/leaderboard-live?metric=$metric&format=comprehensive&limit=50")
    if echo "$response" | grep -q '"status":"success"'; then
        echo "  ✅ Comprehensive format: Success"
        # Extract total players count
        total_players=$(echo "$response" | grep -o '"totalPlayers":"[^"]*"' | cut -d'"' -f4)
        echo "  📈 Total players: $total_players"
    else
        echo "  ❌ Comprehensive format: Failed"
        echo "     Response: $response"
    fi
    
    echo ""
done

echo "🌐 Testing Leaderboard Page..."
echo ""

# Test leaderboard page
response=$(curl -s -w "%{http_code}" "$BASE_URL/leaderboard")
http_code="${response: -3}"
html_content="${response%???}"

if [ "$http_code" = "200" ]; then
    echo "✅ Page loads successfully ($http_code)"
    
    if echo "$html_content" | grep -q "Leaderboard"; then
        echo "✅ Contains title: Yes"
    else
        echo "❌ Contains title: No"
    fi
    
    if echo "$html_content" | grep -q "__next"; then
        echo "✅ React app structure: Yes"
    else
        echo "❌ React app structure: No"
    fi
    
    if echo "$html_content" | grep -q "leaderboard.js"; then
        echo "✅ JavaScript bundle: Yes"
    else
        echo "❌ JavaScript bundle: No"
    fi
    
    echo "🎉 Leaderboard page is properly configured!"
else
    echo "❌ Page failed to load: $http_code"
fi

echo ""

echo "🔗 Testing User Menu Integration..."
echo ""

# Test home page (where user menu is)
response=$(curl -s -w "%{http_code}" "$BASE_URL/")
http_code="${response: -3}"
html_content="${response%???}"

if [ "$http_code" = "200" ]; then
    echo "✅ Home page loads: Yes"
    
    if echo "$html_content" | grep -q "Leaderboard\|CustomUserMenu"; then
        echo "✅ User menu integration: Found"
    else
        echo "⚠️  User menu integration: Not found in HTML (may be loaded dynamically)"
    fi
else
    echo "❌ Home page failed: $http_code"
fi

echo ""
echo "=================================================="
echo "✨ Leaderboard tests completed!"
echo ""
echo "📝 Next steps:"
echo "  1. Visit http://localhost:3000/leaderboard to see the UI"
echo "  2. Click the Leaderboard button in the user menu"
echo "  3. Test different metrics and auto-refresh"
echo "  4. Create some test games to populate data"
echo "" 