import { createUniswap } from './uniswap';

async function main() {
  const uniswap = createUniswap();

  const ETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  const FOG = '0x694208754de9f72abef9b987893d30ad84e59646';

  const balance = await uniswap.getPair(ETH, FOG);
  console.log("ETH/FOG Pancake Pair", balance.toString());
  const reserves = await uniswap.getReserves(balance);
  console.log("Reserves", reserves);
  // const swap = await uniswap.swapETHForTokens(FOG, "0.001", "3.8");
  // console.log("Swap", swap);
  // const swap2 = await uniswap.swapTokensForETH(FOG, "1000000", "5");
  // console.log("Swap2", swap2);
}

main().catch((err) => console.error(err));
