#!/bin/bash

FACTORY="0x57A9156f9b3fFa1b603F188f0f64FF93f51C62F8"
RPC="https://timothy.megaeth.com/rpc"

check_block() {
    local block=$1
    local hex_block=$(printf "0x%x" $block)
    local code=$(curl -s -X POST "$RPC" -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$FACTORY\",\"$hex_block\"],\"id\":1}" \
        | jq -r '.result')

    if [ "$code" != "0x" ] && [ ${#code} -gt 10 ]; then
        echo "1"  # Contract exists
    else
        echo "0"  # Contract doesn't exist
    fi
}

echo "Binary searching for factory deployment block..."
echo ""

# We know:
# - Factory did NOT exist at 21,000,000
# - First pair was created somewhere between 21,000,000 and 21,684,900
# So factory must be deployed in that range

low=21000000
high=21684900

echo "Searching between blocks $low and $high..."
echo ""

while [ $((high - low)) -gt 1 ]; do
    mid=$(((low + high) / 2))
    exists=$(check_block $mid)

    if [ "$exists" = "1" ]; then
        echo "Block $mid: ✓ Factory exists"
        high=$mid
    else
        echo "Block $mid: ✗ Factory does not exist"
        low=$mid
    fi
done

echo ""
echo "Factory deployed at approximately block: $high"
echo ""
echo "Verifying..."
exists_at_high=$(check_block $high)
exists_at_low=$(check_block $low)

if [ "$exists_at_high" = "1" ] && [ "$exists_at_low" = "0" ]; then
    echo "✓ Confirmed: Factory deployed at block $high"
    echo ""
    echo "Update your subgraph.yaml startBlock to: $high"
else
    echo "⚠ Could not pinpoint exact deployment block"
    echo "Factory exists at $high: $exists_at_high"
    echo "Factory exists at $low: $exists_at_low"
fi
