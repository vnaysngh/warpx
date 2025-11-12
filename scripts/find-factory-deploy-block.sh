#!/bin/bash

# Search for first PairCreated event to find deployment block
FACTORY="0x57A9156f9b3fFa1b603F188f0f64FF93f51C62F8"
PAIR_CREATED_TOPIC="0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9"
RPC="https://carrot.megaeth.com/rpc"

echo "Searching for first pair creation event..."

# Search in ranges (100k blocks at a time to respect limit)
for start in 16000000 17000000 18000000 19000000 20000000 21000000; do
  end=$((start + 99999))
  hex_start=$(printf "0x%x" $start)
  hex_end=$(printf "0x%x" $end)

  result=$(curl -s -X POST "$RPC" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getLogs\",\"params\":[{\"fromBlock\":\"$hex_start\",\"toBlock\":\"$hex_end\",\"address\":\"$FACTORY\",\"topics\":[\"$PAIR_CREATED_TOPIC\"]}],\"id\":1}")

  count=$(echo "$result" | jq -r '.result | length')

  if [ "$count" != "0" ] && [ "$count" != "null" ]; then
    echo "Found $count events in range $start - $end"
    first_block=$(echo "$result" | jq -r '.result[0].blockNumber')
    decimal_block=$(printf "%d" $first_block)
    echo "First pair created at block: $decimal_block"
    echo "Use startBlock: $decimal_block (or a bit earlier like $((decimal_block - 1000)))"
    exit 0
  else
    echo "No events in range $start - $end"
  fi
done

echo "No events found in searched ranges"
