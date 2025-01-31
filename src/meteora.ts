import { BN } from '@coral-xyz/anchor';
import DLMM, { BinArrayAccount, type SwapParams } from '@meteora-ag/dlmm';
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { SOL_PRIVATE_KEY, SOL_RPC_URL, DEFAULT_SLIPPAGE } from './config';
import { Currency, MeteoraSwapOptions } from './types';

const USDC_PUBKEY = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOL_PUBKEY = new PublicKey('So11111111111111111111111111111111111111112');

export const createMeteora = () => {
  if (!SOL_PRIVATE_KEY) {
    throw new Error('SOL_PRIVATE_KEY is required');
  }

  const user = Keypair.fromSecretKey(new Uint8Array(bs58.decode(SOL_PRIVATE_KEY || '')));
  const connection = new Connection(SOL_RPC_URL || 'https://api.mainnet-beta.solana.com', 'finalized');

  const getDLMMPool = async (pool: PublicKey) => {
    return await DLMM.create(connection, pool);
  };

  const getBalance = async () => {
    const solBalance = await connection.getBalance(user.publicKey);
    return solBalance / 1e9;
  };

  const getSwapQuote = (
    dlmmPool: DLMM,
    inAmount: BN,
    swapForY: boolean,
    allowedSlippage: BN,
    swapBinArrays: BinArrayAccount[],
  ) => {
    try {
      return dlmmPool.swapQuote(inAmount, swapForY, allowedSlippage, swapBinArrays);
    } catch (error) {
      throw new Error(`❌ Quote error: ${error.message}`);
    }
  };

  const getInOptions = (from: Currency, amount: number) => {
    if (from === 'usdc') {
      return {
        inToken: USDC_PUBKEY,
        inAmount: new BN(amount * 1e6),
      };
    }

    return {
      inToken: SOL_PUBKEY,
      inAmount: new BN(amount * 1e9),
    };
  };

  const getSwapParams = async (
    dlmmPool: DLMM,
    {
      from,
      to,
      amount,
      swapForY,
      slippage,
    }: MeteoraSwapOptions,
  ) => {
    const outToken = new PublicKey(to);
    const minOutSlippageAmount = new BN(0);

    const { inToken, inAmount } = getInOptions(from, amount);
    const allowedSlippage = new BN(slippage);

    const swapBinArrays = await dlmmPool.getBinArrayForSwap(swapForY);
    const swapQuote = getSwapQuote(dlmmPool, inAmount, swapForY, allowedSlippage, swapBinArrays);

    const swapParams: SwapParams = {
      inToken,
      outToken,
      inAmount,
      minOutAmount: minOutSlippageAmount,
      lbPair: dlmmPool.pubkey,
      user: user.publicKey,
      binArraysPubkey: swapQuote.binArraysPubkey,
    };

    return swapParams;
  };

  const swap = async (
    dlmmPool: DLMM,
    {
      from,
      to,
      amount,
      swapForY = true, // if dlmm POOL is USDC_SOL_POOL and from is SOL, swapForY should be FALSE otherwise TRUE
      slippage = DEFAULT_SLIPPAGE * 100, // 2%
    }: MeteoraSwapOptions,
  ) => {
    const swapParams: SwapParams = await getSwapParams(dlmmPool, { from, to, amount, swapForY, slippage });
    const dlmmSwap = await dlmmPool.swap(swapParams);

    try {
      console.log(`⌛️ Swapping ${amount} ${from.toUpperCase()} to ${to}`);
      const swapTxHash = await sendAndConfirmTransaction(connection, dlmmSwap, [user]);
      console.log(`✅ Successfully Swapped ${amount} ${from.toUpperCase()} to ${to}`);

      return swapTxHash;
    } catch (error) {
      throw error;
    }
  };

  const swapByPool = async (
    from: Currency,
    poolAddress: string,
    caAddress: string,
    amount: number,
    swapForY: boolean,
  ) => {
    try {
      const swapPool = new PublicKey(poolAddress);
      const dllmPool = await getDLMMPool(swapPool);

      return await swap(dllmPool, {
        from,
        to: caAddress,
        amount,
        swapForY,
      });
    } catch (error) {
      throw error;
    }
  };

  return {
    getBalance,
    getDLMMPool,
    swap,
    swapByPool,
  };
};