import { createPanCakeV3 } from './pancake3';

const BNB = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
const IME = '0x7bC75e291E656E8658D66Be1cc8154A3769A35Dd';
const TST = '0x86bb94ddd16efc8bc58e6b056e8df71d9e666429';

async function mainV3() {
  const pancakeV3 = createPanCakeV3();

  const balance = await pancakeV3.getPair(BNB, TST);
  console.log("BNB/IME Pancake Pair", balance.toString());
  const reserves = await pancakeV3.getReserves(balance);
  console.log("Reserves", reserves);

  if (reserves === 'Pools not found') {
    console.log("Pools not found");
    return;
  }

  // const swap = await pancakeV3.swapBNBForTokens(TST, "0.002", "1", reserves);
  // console.log("Swap", swap);
  // const swap2 = await pancakeV3.swapTokensForBNB(TST, "10", "1", reserves);
  // console.log("Swap2", swap2);
}

mainV3();