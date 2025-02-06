import { createPanCake } from './pancake';

async function main() {
  const pancake = createPanCake();

  const BNB = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
  const IME = '0x7bC75e291E656E8658D66Be1cc8154A3769A35Dd';
  const TST = '0x86bb94ddd16efc8bc58e6b056e8df71d9e666429';

  const balance = await pancake.getPair(BNB, TST);
  console.log("BNB/TST Pancake Pair", balance.toString());
  const reserves = await pancake.getReserves(balance);
  console.log("Reserves", reserves);
  const swap = await pancake.swapBNBForTokens(TST, "0.002", "1");
  console.log("Swap", swap);
  const swap2 = await pancake.swapTokensForBNB(TST, "52", "1");
  console.log("Swap2", swap2);
}

main().catch((err) => console.error(err));
