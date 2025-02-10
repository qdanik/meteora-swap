import { MAX_RETRY } from '../config';
import { createPanCakeV3 } from './pancake3';
import { NETWORKS } from './pancake3.constants';

const BNB = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
const TST = '0x86bb94ddd16efc8bc58e6b056e8df71d9e666429';

const ETH = '0x2170ed0880ac9a755fd29b2688956bd959f933f8';
const CAKE = '0x152649eA73beAb28c5b49B26eb48f7EAD6d4c898';

const BASE = '0x4200000000000000000000000000000000000006';
const DEGEN = '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed';

async function mainV3BnB() {
  let retryCount = 0;
  const pancakeV3 = createPanCakeV3(NETWORKS.BNB, console.log);

  const pairPools = await pancakeV3.getPairPools(BNB, TST);
  console.log("BNB/TST Pancake Pair", pairPools);
  const pool = await pancakeV3.findPools(pairPools);
  console.log("Pool", pool);

  if (pool === 'Pools not found') {
    console.log("Pools not found");
    return;
  }

  const swapToken = async (token: string) => {
    try {
      return await pancakeV3.buyToken(token, '0.005', '1', pool);
    } catch (error) {
      if (retryCount < MAX_RETRY) {
        retryCount++;
        console.log(`🍰 ⌛️ | (${retryCount}) Попробуем ещё раз...`);
        return Promise.resolve(swapToken(token));
      }

      return Promise.reject(error);
    }
  };

  // const swap = await swapToken('0x86Bb94DdD16Efc8bc58e6b056e8df71D9e666429');
  // console.log("Swap", swap);
  // const swap2 = await pancakeV3.sellToken(TST, "2.56", "1", pool);
  // console.log("Swap2", swap2);
}

mainV3BnB();

async function mainV3ETH() {
  const pancakeV3 = createPanCakeV3(NETWORKS.BASE, console.log);

  const pairPools = await pancakeV3.getPairPools(DEGEN, BASE);
  console.log("DEGEN/BASE Pancake Pair", pairPools);

  const pool = await pancakeV3.findPools(pairPools);
  console.log("Pool", pool);

  if (pool === 'Pools not found') {
    console.log("Pools not found");
    return;
  }

  // const swap = await pancakeV3.buyToken(DEGEN, "0.0001", "1", reserves);
  // console.log("Swap", swap);
  // const swap2 = await pancakeV3.sellToken(DEGEN, "67", "1", reserves);
  // console.log("Swap2", swap2);
}

// mainV3ETH();