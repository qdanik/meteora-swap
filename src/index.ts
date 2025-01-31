import { BN } from '@coral-xyz/anchor';
import DLMM, { BinArrayAccount, type SwapParams } from '@meteora-ag/dlmm';
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import dotenv from 'dotenv';
  
dotenv.config();

if(!process.env.SOL_PRIVATE_KEY) {
  throw new Error('SOL_PRIVATE_KEY is required');
}

const user = Keypair.fromSecretKey(new Uint8Array(bs58.decode(process.env.SOL_PRIVATE_KEY || '')));
const RPC = process.env.SOL_RPC || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC, 'finalized');

const USDC_SOL_POOL = new PublicKey('7zwc5JuKuyhgc1VELA59KGAY2xmd3HZGwJNLCfHXZP99');
const USDC_PUBKEY = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOL_PUBKEY = new PublicKey('So11111111111111111111111111111111111111112');

export const getDLMMPool = async (pool: PublicKey) => {
  return await DLMM.create(connection, pool);
};

export const getBalance = async () => {
  const solBalance = await connection.getBalance(user.publicKey);
  return solBalance / 10 ** 9;
};

export const getSwapQuote = async (
  dlmmPool: DLMM,
  inAmount: BN,
  swapForY: boolean,
  allowedSlippage: BN,
  swapBinArrays: BinArrayAccount[],
) => {
  try {
    return await dlmmPool.swapQuote(inAmount, swapForY, allowedSlippage, swapBinArrays);
  } catch (error) {
    throw new Error(`[SWAP.quote] ${error.message}`);
  }
}

export const swap = async (
  dlmmPool: DLMM,
  {
    from,
    to,
    amount,
    swapForY = true, // if dlmm POOL is USDC_SOL_POOL and from is SOL, swapForY should be FALSE otherwise TRUE
    slippage = 200, // 2%
  }: {
    from: 'usdc' | 'sol';
    to: string;
    amount: number;
    slippage?: number;
    swapForY?: boolean;
  },
) => {
  const outToken = new PublicKey(to);
  const minOutAmount = new BN(0);

  const inToken = from === 'usdc' ? USDC_PUBKEY : SOL_PUBKEY;
  const inAmount =  new BN(from === 'usdc' ? amount * 1e6 : amount * 1e9);
  const allowedSlippage = new BN(slippage);

  const swapBinArrays = await dlmmPool.getBinArrayForSwap(swapForY);
  const swapQuote = await getSwapQuote(dlmmPool, inAmount, swapForY, allowedSlippage, swapBinArrays);
  const swapParams: SwapParams = {
    inToken,
    outToken,
    inAmount,
    minOutAmount,
    lbPair: dlmmPool.pubkey,
    user: user.publicKey,
    binArraysPubkey: swapQuote.binArraysPubkey,
  };
  
  const dlmmSwap = await dlmmPool.swap(swapParams);

  try {
    const swapTxHash = await sendAndConfirmTransaction(connection, dlmmSwap, [user]);
    console.log('[SWAP.tx]', swapTxHash);
  } catch (error) {
    throw error;
  }
};

// (async () => {
//   const balance = await getBalance();

//   console.log('[BALANCE]', balance);

  // const dllmPool = await getDLMMPool(USDC_SOL_POOL);

  // swap 1 USDC to SOL
  // await swap(dllmPool, {
  //   from: 'usdc',
  //   to: 'So11111111111111111111111111111111111111112',
  //   amount: 1,
  //   swapForY: true,
  // });

  // swap 1 SOL to USDC
  // await swap(dllmPool, {
  //   from: 'sol',
  //   to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  //   amount: 1,
  //   swapForY: false,
  // });
// })();
