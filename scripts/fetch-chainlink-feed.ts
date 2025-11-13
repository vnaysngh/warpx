import { ethers } from "ethers";

const FEED_ADDRESS = "0xfBFff08fE4169853F7B1b5Ac67eC10dc8806801d";
const ABI = [
  "function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
  "function description() view returns (string)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(
    process.env.MEGAETH_RPC_URL || "https://timothy.megaeth.com/rpc"
  );
  const feed = new ethers.Contract(FEED_ADDRESS, ABI, provider);
  const [roundId, answer, startedAt, updatedAt, answeredInRound] =
    await feed.latestRoundData();
  const decimals = await feed.decimals();
  const description = await feed.description();
  const normalized = Number(answer) / 10 ** Number(decimals);
  console.log("description:", description);
  console.log("roundId:", roundId.toString());
  console.log("answer:", answer.toString());
  console.log("decimals:", decimals);
  console.log("normalized price:", normalized);
  console.log("startedAt:", new Date(Number(startedAt) * 1000).toISOString());
  console.log("updatedAt:", new Date(Number(updatedAt) * 1000).toISOString());
  console.log("answeredInRound:", answeredInRound.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
