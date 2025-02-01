import { BN } from '@coral-xyz/anchor';
import DLMM, { BinArrayAccount, type SwapParams } from '@meteora-ag/dlmm';
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { SOL_PRIVATE_KEY, SOL_RPC_URL, DEFAULT_SLIPPAGE, DEFAULT_CA, DEFAULT_USDC_AMOUNT, DEFAULT_SOL_AMOUNT, MAX_RETRY, RMQ_NOTIFY_QUEUE } from './config';
import { RabbitMQConnection } from './rabbit';

export const createMeteora = (mqConnection?: RabbitMQConnection) => {
  if (!SOL_PRIVATE_KEY) {
    throw new Error('SOL_PRIVATE_KEY is required');
  }

  const user = Keypair.fromSecretKey(new Uint8Array(bs58.decode(SOL_PRIVATE_KEY || '')));
  const connection = new Connection(SOL_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');

  const logger = (text: string) => {
    if (mqConnection) {
      mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, { text });
    }

    console.log(text);
  };

  const getDLMMPool = async (pool: PublicKey) => {
    return await DLMM.create(connection, pool);
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
      throw new Error(`[SWAP.quote] ${error.message}`);
    }
  };

  const getBalance = async () => {
    const solBalance = await connection.getBalance(user.publicKey);
    return solBalance / 1e9;
  };

  const getBalanceByToken = async (address: string) => {
    try {
      const token = new PublicKey(address);
      const tokenBalance = await connection.getParsedTokenAccountsByOwner(user.publicKey, { mint: token }, 'confirmed');

      return tokenBalance.value[0].account.data.parsed.info.tokenAmount as {
        amount: string;
        decimals: number;
        uiAmount: number;
        uiAmountString: string;
      };
    } catch (error) {
      throw new Error(`❌ Could not get token balance: ${error.message}`);
    }
  };

  const getDefaultAmount = (inContract: string) => {
    if (inContract === DEFAULT_CA.USDC) {
      return DEFAULT_USDC_AMOUNT;
    }

    if (inContract === DEFAULT_CA.SOL) {
      return DEFAULT_SOL_AMOUNT;
    }

    throw new Error(`❌ Could not get default amount for ${inContract}`);
  };

  const getTokenAmount = async (inContract: string, amount?: number) => {
    try {
      const defaultAmount = amount ?? getDefaultAmount(inContract);
      if (inContract === DEFAULT_CA.SOL) {
        return {
          defaultAmount,
          tokenAmount: defaultAmount * 10 ** 9,
        };
      }

      const { decimals } = await getBalanceByToken(inContract);

      return {
        defaultAmount,
        tokenAmount: defaultAmount * 10 ** decimals,
      };
    } catch (error) {
      throw new Error(`❌ Could not get token amount: ${error.message}`);
    }
  };

  const swap = async (
    poolAddress: string,
    nameX: string,
    nameY: string,
    caX: string,
    caY: string,
    amount?: number,
    buyYForX: boolean = true, // Buy token Y to X when it is true, else reversed
    slippage: number = DEFAULT_SLIPPAGE * 100,
  ) => {
    const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
    const minOutAmount = new BN(0);

    const inName = buyYForX ? nameX : nameY;
    const inContract = buyYForX ? caX : caY;
    const outName = buyYForX ? nameY : nameX;
    const outContract = buyYForX ? caY : caX;
    const { tokenAmount, defaultAmount } = await getTokenAmount(inContract, amount);

    const inAmount = new BN(tokenAmount);
    const inToken = new PublicKey(inContract);
    const outToken = new PublicKey(outContract);
    const swapYForX = caY === outContract;

    const allowedSlippage = new BN(slippage);

    const swapBinArrays = await dlmmPool.getBinArrayForSwap(swapYForX);
    const swapQuote = getSwapQuote(dlmmPool, inAmount, swapYForX, allowedSlippage, swapBinArrays);
    const swapParams: SwapParams = {
      inAmount,
      inToken,
      outToken,
      minOutAmount,
      lbPair: dlmmPool.pubkey,
      user: user.publicKey,
      binArraysPubkey: swapQuote.binArraysPubkey,
    };

    const dlmmSwap = await dlmmPool.swap(swapParams);

    try {
      logger(`⌛️ Swapping ${defaultAmount} ${inName.toUpperCase()} to ${outName.toUpperCase()}`);
      const swapTxHash = await sendAndConfirmTransaction(connection, dlmmSwap, [user], {
        commitment: 'confirmed',
        maxRetries: MAX_RETRY,
      });
      logger(`✅ Successfully Swapped ${defaultAmount} ${inName.toUpperCase()} to ${outName.toUpperCase()}.\n Transaction Hash: ${swapTxHash}`);

      return {
        txHash: swapTxHash,
        inAmount: defaultAmount,
        inName,
        outName,
      };
    } catch (error) {
      logger(`❌ Could not swap ${defaultAmount} ${inName.toUpperCase()} to ${outName.toUpperCase()}: ${error.message}`);
      return {
        txHash: error?.signature,
        inAmount: defaultAmount,
        inName,
        outName,
      };
    }
  };

  return {
    getBalance,
    getBalanceByToken,
    getTokenAmount,
    getDefaultAmount,
    getDLMMPool,
    swap,
  };
};