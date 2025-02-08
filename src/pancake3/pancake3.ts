import { ethers, parseEther, parseUnits, formatUnits } from "ethers";
import { DEFAULT_SLIPPAGE } from "../config";
import { Pool, Route, Trade, TICK_SPACINGS, nearestUsableTick, TickListDataProvider, FeeAmount } from "@uniswap/v3-sdk";
import {
  Token,
  CurrencyAmount,
  Percent,
  TradeType,
} from "@uniswap/sdk-core";
import JSBI from 'jsbi';
import { NetworkConfig } from './pancake3.constants';

// fee-tier 0.3% (3000) для одного пула
const DEFAULT_FEE_TIER = 3000;

// ===================== ABIs =====================
const factoryAbi = [
  "function getPool(address token0, address token1, uint24 fee) external view returns (address)",
];

const poolAbi = [
  "function slot0() external view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function ticks(int24) external view returns (uint128 liquidityGross,int128 liquidityNet,uint256 feeGrowthOutside0X128,uint256 feeGrowthOutside1X128,int56 tickCumulativeOutside,int160 secondsPerLiquidityOutsideX128,uint32 secondsOutside,bool initialized)",
];

const routerAbi = [
  `function exactInputSingle(
      (address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)
    ) external payable returns (uint256 amountOut)`,
];

const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function withdraw(uint256) public",
  "function deposit() public payable",
];

export const createPanCakeV3 = (network: NetworkConfig) => {
  if (!network.privateKey) {
    throw new Error("BSC_PRIVATE_KEY is required");
  }

  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const wallet = new ethers.Wallet(network.privateKey, provider);

  async function getTokenDecimals(tokenAddress: string) {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    return Number(await tokenContract.decimals());
  }

  async function formatToken(token: string, rawAmount: bigint) {
    const decimals = await getTokenDecimals(token);
    return formatUnits(rawAmount, decimals);
  }

  async function parseToken(token: string, amountStr: string) {
    const decimals = await getTokenDecimals(token);
    return parseUnits(amountStr, decimals);
  }

  const getPair = async (token0: string, token1: string) => {
    const factory = new ethers.Contract(network.factoryAddress, factoryAbi, wallet);

    const FEES = [100, 200, 300, 400, 500, 3000, 10000];
    const pools = await Promise.all(
      FEES.map(async (fee) => {
        const pool = await factory.getPool(token0, token1, fee);
        if (pool !== ethers.ZeroAddress) return fee;
      })
    );
    console.log("Pools:", pools);
    const activePools = pools.filter(Boolean) as number[];
    if (activePools.length === 0) {
      return [];
    }

    return await Promise.all(activePools.map(async (fee) => ({
      fee,
      pool: await factory.getPool(token0, token1, fee),
    })));
  };

  const getReserves = async (pools: { fee: number, pool: string; }[]) => {
    if (pools.length === 0) {
      return 'Pools not found';
    }

    const reserves = await Promise.all(pools.map(async ({ pool, fee }) => {
      const poolContract = new ethers.Contract(pool, poolAbi, wallet);
      const [liq, slot0Data, token0, token1] = await Promise.all([
        poolContract.liquidity(),
        poolContract.slot0(),
        poolContract.token0(),
        poolContract.token1(),
      ]);
      const sqrtPriceX96 = slot0Data[0].toString();
      const tickCurrent = slot0Data[1];
      const liquidity = liq.toString();

      return {
        address: pool,
        fee,
        token0,
        token1,
        sqrtPriceX96,
        tickCurrent: Number(tickCurrent),
        liquidity,
      };
    }));
    const sorted = reserves.sort((a, b) => a.liquidity - b.liquidity);
    const moreLiquid = sorted[sorted.length - 1];

    if (!moreLiquid || !moreLiquid.liquidity) {
      throw new Error("[v3] No liquidity found");
    }

    return moreLiquid;
  };

  function getTickRange(currentTick: number, tickSpacing: number) {
    const nearestTick = nearestUsableTick(currentTick, tickSpacing);

    const numTicksAround = 10;
    const minTick = nearestTick - tickSpacing * numTicksAround;
    const maxTick = nearestTick + tickSpacing * numTicksAround;

    return { minTick, maxTick, tickSpacing };
  }

  async function getPoolTicks(poolContract: ethers.Contract, feeAmount: FeeAmount) {
    try {
      const slot0 = await poolContract.slot0();
      const currentTick = Number(slot0.tick);

      const { minTick, maxTick, tickSpacing } = getTickRange(
        currentTick,
        TICK_SPACINGS[feeAmount]
      );

      console.log(`Fetching ticks from ${minTick} to ${maxTick}...${tickSpacing}`);

      const tickPromises: Promise<{ liquidityGross: any, liquidityNet: any; }>[] = [];
      for (let i = minTick; i <= maxTick; i += tickSpacing) {
        tickPromises.push(poolContract.ticks(i).catch(() => Promise.resolve([0, 0])));
      }

      const tickResults = await Promise.all(tickPromises);

      const ticks = tickResults
        .map((tickData, i) => {
          const tick = minTick + i * tickSpacing;
          return {
            index: +tick,
            liquidityNet: JSBI.BigInt(Number(tickData[1])),
            liquidityGross: JSBI.BigInt(Number(tickData[0])),
          };
        })
        .filter((tick) => JSBI.toNumber(tick.liquidityNet) > 0);

      console.log(`Found ${ticks.length} initialized ticks`);
      console.log(`tickResults`, ticks);
      return ticks;
    } catch (error) {
      console.error("Error fetching ticks:", error);
      throw error;
    }
  }

  async function computeAmountOutMinSingleHop(params: {
    poolAddress: string;
    tokenInAddress: string;
    tokenOutAddress: string;
    feeTier: number;
    amountInHuman: string;
    slippageBps: number;
    sqrtPriceX96: string;
    liquidity: string;
    tickCurrent: number;
  }) {
    const {
      poolAddress,
      tokenInAddress,
      tokenOutAddress,
      feeTier,
      amountInHuman,
      slippageBps,
      sqrtPriceX96,
      liquidity,
      tickCurrent,
    } = params;

    const tokenInDecimals = await getTokenDecimals(tokenInAddress);
    const tokenOutDecimals = await getTokenDecimals(tokenOutAddress);
    const tokenIn = new Token(network.chainId, tokenInAddress, tokenInDecimals, "TokenIn", "TokenIn");
    const tokenOut = new Token(network.chainId, tokenOutAddress, tokenOutDecimals, "TokenOut", "TokenOut");
    const poolContract = new ethers.Contract(
      poolAddress,
      poolAbi,
      provider
    );
    const ticks = await getPoolTicks(poolContract, feeTier);

    if (!ticks || ticks.length === 0) {
      throw new Error(`No ticks found for pool ${poolAddress}`);
    }

    const tickDataProvider = new TickListDataProvider(
      ticks,
      TICK_SPACINGS[feeTier]
    );

    // throw new Error("Not implemented");
    const pool = new Pool(
      tokenIn,
      tokenOut,
      feeTier,
      sqrtPriceX96,
      liquidity,
      tickCurrent,
      tickDataProvider,
    );
    const amountIn = CurrencyAmount.fromRawAmount(
      tokenIn,
      ethers.parseUnits(amountInHuman, tokenInDecimals).toString()
    );
    console.log("amountIn:", amountIn.toExact());

    const route = new Route([pool], tokenIn, tokenOut);
    const trade = await Trade.fromRoute(route, amountIn, TradeType.EXACT_INPUT);

    const expectedOut = trade.outputAmount;
    console.log("expectedOut:", expectedOut.toExact());

    const slippageTolerance = new Percent(slippageBps, 10_000);

    const minimumAmountOut = trade.minimumAmountOut(slippageTolerance);
    console.log(`minOut (with slippage ${slippageBps / 100}%):`, minimumAmountOut.toExact());

    const rawMinOut = minimumAmountOut.quotient;
    console.log("amountOutMinimum (raw bigint):", rawMinOut.toString());

    return rawMinOut;
  }

  async function getTokenBalance(token: string) {
    const contract = new ethers.Contract(token, erc20Abi, wallet);
    const rawBal = await contract.balanceOf(wallet.address);
    return formatToken(token, rawBal);
  }

  const swapBNBForTokens = async (
    tokenB: string,
    bnbAmount: string,
    priorityFee: string,
    pool: {
      address: string;
      fee: number;
      token0: string;
      token1: string;
      sqrtPriceX96: string;
      liquidity: string;
      tickCurrent: number;
    }
  ) => {
    const amountOutMinimum = await computeAmountOutMinSingleHop({
      poolAddress: pool.address,
      tokenInAddress: pool.token0,
      tokenOutAddress: pool.token1,
      feeTier: pool.fee ?? DEFAULT_FEE_TIER,
      amountInHuman: bnbAmount,
      slippageBps: DEFAULT_SLIPPAGE * 100,
      sqrtPriceX96: pool.sqrtPriceX96,
      liquidity: pool.liquidity,
      tickCurrent: pool.tickCurrent,
    });

    const bnbBal = await provider.getBalance(wallet.address);
    const gasPrice = ethers.parseUnits(priorityFee, "gwei");
    console.log(`Gas price: ${Number(gasPrice)}`);
    const neededBNB = parseEther(bnbAmount);
    console.log(`BNB needed: ${neededBNB}`);
    if (bnbBal < neededBNB) {
      throw new Error(`Insufficient BNB: have=${bnbBal}, need=${neededBNB}`);
    }

    // BNB -> WBNB
    const wbnbContract = new ethers.Contract(
      network.wrappedNativeAddress,
      erc20Abi,
      wallet
    );
    console.log(`Wrapping ${bnbAmount} BNB into WBNB...`);
    const currentWBNBBalance = await wbnbContract.balanceOf(wallet.address);
    const wrapTx = await wbnbContract.deposit({
      value: neededBNB,
      gasPrice,
    });
    await wrapTx.wait();
    console.log(`WBNB minted!`);

    // Approve
    console.log(`WBNB balance (before): ${currentWBNBBalance}`);
    const totalWbnbBalance = await wbnbContract.balanceOf(wallet.address);
    console.log(`WBNB balance (after): ${totalWbnbBalance}`);
    const differenceWbnb = JSBI.subtract(JSBI.BigInt(Number(totalWbnbBalance)), JSBI.BigInt(Number(currentWBNBBalance)));
    console.log(`WBNB difference: ${differenceWbnb}`);
    const wbnbBalance = JSBI.toNumber(JSBI.add(differenceWbnb, JSBI.BigInt(Number(gasPrice))));
    console.log(`WBNB expected allowance: ${wbnbBalance}`);
    const allowance = await wbnbContract.allowance(wallet.address, network.routerAddress);
    console.log(`WBNB current allowance: ${allowance}`);

    if (allowance < wbnbBalance) {
      console.log(`Approving Router to spend WBNB...`);
      const approveTx = await wbnbContract.approve(network.routerAddress, wbnbBalance, {
        gasPrice,
      });
      await approveTx.wait();
      console.log(`Approved!`);
    }

    // 3) WBNB -> tokenB
    const router = new ethers.Contract(network.routerAddress, routerAbi, wallet);
    // deadline
    const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

    const params = {
      tokenIn: network.wrappedNativeAddress,
      tokenOut: tokenB,
      fee: pool.fee ?? DEFAULT_FEE_TIER,
      recipient: wallet.address,
      deadline,
      amountIn: BigInt(JSBI.toNumber(JSBI.subtract(differenceWbnb, JSBI.BigInt(Number(gasPrice))))),
      amountOutMinimum: BigInt(JSBI.toNumber(amountOutMinimum)),
      sqrtPriceLimitX96: 0,
    };

    console.log(`Swapping WBNB -> ${tokenB} using exactInputSingle...`);
    console.log("params:", params);
    const tx = await router.exactInputSingle(params, {
      gasPrice,
    });
    console.log("tx hash:", tx.hash);
    const rcpt = await tx.wait();
    console.log(`Swap BNB -> Token confirmed in block ${rcpt.blockNumber}`);

    return rcpt;
  };

  const swapTokensForBNB = async (
    tokenA: string,
    tokenAmount: string,
    priorityFee: string,
    pool: {
      address: string;
      fee: number;
      token0: string;
      token1: string;
      sqrtPriceX96: string;
      liquidity: string;
      tickCurrent: number;
    }
  ) => {
    const amountOutMinimum = await computeAmountOutMinSingleHop({
      poolAddress: pool.address,
      tokenInAddress: pool.token0,
      tokenOutAddress: pool.token1,
      feeTier: pool.fee ?? DEFAULT_FEE_TIER,
      amountInHuman: tokenAmount,
      slippageBps: DEFAULT_SLIPPAGE * 100,
      sqrtPriceX96: pool.sqrtPriceX96,
      liquidity: pool.liquidity,
      tickCurrent: pool.tickCurrent,
    });
    // 1) Check balance
    const contractA = new ethers.Contract(tokenA, erc20Abi, wallet);
    const amountIn = await parseToken(tokenA, tokenAmount);
    const balanceA = await contractA.balanceOf(wallet.address);
    const gasPrice = ethers.parseUnits(priorityFee, "gwei");
    if (balanceA < amountIn) {
      throw new Error(`Insufficient tokenA: have ${balanceA}, need ${amountIn}`);
    }

    // 2) Approve Router
    const allowance = await contractA.allowance(wallet.address, network.routerAddress);
    if (allowance < amountIn) {
      console.log(`Approving router to spend tokenA...`);
      const appTx = await contractA.approve(network.routerAddress, amountIn + gasPrice, {
        gasPrice,
      });
      await appTx.wait();
      console.log(`Approved`);
    }

    // 3) tokenA -> WBNB
    const router = new ethers.Contract(network.routerAddress, routerAbi, wallet);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

    const params = {
      tokenIn: tokenA,
      tokenOut: network.wrappedNativeAddress,
      fee: pool.fee ?? DEFAULT_FEE_TIER,
      recipient: wallet.address,
      deadline,
      amountIn,
      amountOutMinimum: JSBI.toNumber(amountOutMinimum),
      sqrtPriceLimitX96: 0,
    };

    console.log(`Swapping tokenA -> WBNB using exactInputSingle...`);
    console.log("params:", params);
    const tx = await router.exactInputSingle(params, {
      gasPrice,
    });
    console.log("tx hash:", tx.hash);
    const rcpt = await tx.wait();
    console.log(`Swap token -> WBNB confirmed in block ${rcpt.blockNumber}`);

    // 4) Unwrap WBNB -> BNB (withdraw)
    const wbnbContract = new ethers.Contract(
      network.wrappedNativeAddress,
      erc20Abi,
      wallet
    );
    const wbnbBal = await wbnbContract.balanceOf(wallet.address);
    if (wbnbBal > 0n) {
      console.log(`Unwrapping WBNB -> BNB for ${wbnbBal} wei...`);
      const wdTx = await wbnbContract.withdraw(wbnbBal, {
        gasPrice,
      });
      await wdTx.wait();
      console.log(`BNB received!`);
    }

    return rcpt;
  };

  return {
    getPair,
    getReserves,
    getTokenBalance,
    swapBNBForTokens,
    swapTokensForBNB,
  };
};