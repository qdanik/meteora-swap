import { API_URL, DEFAULT_CA } from './config';
import { MeteoraPairsResponse } from './types';
import { createMeteora } from './meteora';

const DEFAULT_ADDRESSES = [DEFAULT_CA.SOL, DEFAULT_CA.USDC];

const hasCorrectMintsCA = (mintX: string, mintY: string) => {
  return DEFAULT_ADDRESSES.includes(mintX) || DEFAULT_ADDRESSES.includes(mintY);
};

const getIncludedTokenPairs = (address: string) => {
  return DEFAULT_ADDRESSES.reduce<string[]>((acc, ca) => [
    ...acc,
    `${ca}-${address}`,
    `${address}-${ca}`,
  ], []);
};

export const findPools = async (address: string) => {
  console.time('findPools');
  const url = new URL(`${API_URL}pair/all_with_pagination`);
  const addresses = getIncludedTokenPairs(address);

  url.searchParams.append('include_pool_token_pairs', addresses.toString());
  url.searchParams.append('limit', '2');

  const response = await fetch(url.toString());
  const data = await response.json() as MeteoraPairsResponse;
  const bestPair = data.pairs[0];

  if (!hasCorrectMintsCA(bestPair.mint_x, bestPair.mint_y)) {
    throw new Error('Invalid pool');
  }

  const poolAddress = bestPair.address;
  const [nameX, nameY] = bestPair.name.split('-');

  return {
    poolAddress,
    nameX,
    nameY,
    caX: bestPair.mint_x,
    caY: bestPair.mint_y,
  };
};

const getTokenBalance = async (address: string) => {
  const meteora = createMeteora();
  const tokenBalance = await meteora.getBalanceByToken(address);
  console.log(`💰 Token balance: ${tokenBalance}`);

  return tokenBalance;
};

const buyToken = async (address: string) => {
  console.time('buy');
  const meteora = createMeteora();
  const params = await findPools(address);

  console.log(`🔍 Found pool: ${params.poolAddress}`);
  const buyYForX = params.caY === address;
  const nameX = buyYForX ? params.nameX : params.nameY;
  const nameY = buyYForX ? params.nameY : params.nameX;

  try {
    await meteora.swap(
      params.poolAddress,
      params.nameX,
      params.nameY,
      params.caX,
      params.caY,
      undefined,
      buyYForX,
      500,
      0.001
    );
    console.log(`✅ Bought ${nameX} to ${nameY}`);
  } catch {
    console.log(`❌ Could not buy ${nameX} to ${nameY}`);
  }
  console.timeEnd('swapByPool');
  console.timeEnd('buy');
};

const sellToken = async (address: string, defaultAmount?: number) => {
  console.time('sell');
  const meteora = createMeteora();
  const params = await findPools(address);

  console.log(`🔍 Found pool: ${params.poolAddress}`);
  const { uiAmount: amount } = await meteora.getBalanceByToken(address);
  const buyYForX = params.caX === address;
  const nameX = buyYForX ? params.nameX : params.nameY;
  const nameY = buyYForX ? params.nameY : params.nameX;

  try {
    await meteora.swap(
      params.poolAddress,
      params.nameX,
      params.nameY,
      params.caX,
      params.caY,
      defaultAmount ?? amount,
      buyYForX,
      500,
      0.001
    );
    console.log(`✅ Sold ${amount} ${nameX} to ${nameY}`);
  } catch {
    console.log(`❌ Could not sell ${amount} ${nameX} to ${nameY}`);
  }
  console.timeEnd('swapByPool');
  console.timeEnd('sell');
};


const start = async () => {
  // await buyToken('6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN');
  // await getTokenBalance('6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN');
  // await sellToken('6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN');
  // await sellToken('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 5);
};

start().catch(console.error);