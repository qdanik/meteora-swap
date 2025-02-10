import { ethers, parseEther, parseUnits, formatUnits } from 'ethers';
import { DEFAULT_SLIPPAGE } from '../config';
import { FEE_POOLS, NetworkConfig } from './pancake3.constants';
import { DEFAULT_FEE_TIER, ERC20_ABI, FACTORY_ABI, POOL_ABI, ROUTER_ABI } from './pancake3.abis';
import { computeAmountOutMinSingleHop, getDeadline } from './pancake3.helpers';

export function createPanCakeV3(
  network: NetworkConfig,
  logAndNotify: (message: string) => void
) {
  if (!network.privateKey) {
    throw new Error(`🍰 ❌ | Неверный приватный ключ для chainId=${network.chainId}`);
  }

  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const signer = new ethers.Wallet(network.privateKey, provider);

  async function getTokenDecimals(tokenAddress: string) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return Number(await tokenContract.decimals());
  }

  async function formatToken(tokenAddress: string, rawAmount: bigint) {
    const decimals = await getTokenDecimals(tokenAddress);
    return formatUnits(rawAmount, decimals);
  }

  async function parseToken(tokenAddress: string, amountStr: string) {
    const decimals = await getTokenDecimals(tokenAddress);
    return parseUnits(amountStr, decimals);
  }

  async function checkAndApproveToken(
    tokenAddress: string,
    spender: string,
    requiredAmount: bigint,
    gasPrice: bigint
  ) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const currentAllowance = await tokenContract.allowance(signer.address, spender);

    if (currentAllowance < requiredAmount) {
      logAndNotify(`🍰 ⌛️ | Аппрув ${tokenAddress} для спендера: ${spender}...`);
      const approveTx = await tokenContract.approve(spender, requiredAmount, { gasPrice });
      await approveTx.wait();
      logAndNotify(`🍰 ✅ | Аппрув ${tokenAddress} успешно выполнен!`);
    }
  }

  async function wrapNativeToken(amountWei: bigint, gasPrice: bigint) {
    const wrappedContract = new ethers.Contract(network.wrappedNativeAddress, ERC20_ABI, signer);

    logAndNotify(
      `🍰 ⌛️ | Оборачиваем ${amountWei} wei (${network.name}) в ${network.wrappedName}...`
    );
    const wrapTx = await wrappedContract.deposit({ value: amountWei, gasPrice });
    await wrapTx.wait();
    logAndNotify(`🍰 ✅ | Получено ${network.wrappedName}!`);
  }

  async function unwrapNativeToken(amountWei: bigint, gasPrice: bigint) {
    const wrappedContract = new ethers.Contract(network.wrappedNativeAddress, ERC20_ABI, signer);

    if (amountWei > 0n) {
      logAndNotify(
        `🍰 ⌛️ | Распаковываем ${amountWei} wei (${network.wrappedName}) в ${network.name}...`
      );
      const withdrawTx = await wrappedContract.withdraw(amountWei, { gasPrice });
      await withdrawTx.wait();
      logAndNotify(`🍰 ✅ | Получено ${network.name}!`);
    }
  }

  async function getPairPools(tokenA: string, tokenB: string) {
    const factory = new ethers.Contract(network.factoryAddress, FACTORY_ABI, signer);

    const pools = await Promise.all(
      FEE_POOLS.map(async (fee) => {
        const poolAddress = await factory.getPool(tokenA, tokenB, fee);
        return poolAddress !== ethers.ZeroAddress ? fee : null;
      })
    );

    const activeFees = pools.filter(Boolean) as number[];
    if (activeFees.length === 0) {
      return [];
    }

    return Promise.all(
      activeFees.map(async (fee) => {
        const poolAddress = await factory.getPool(tokenA, tokenB, fee);
        return { fee, pool: poolAddress };
      })
    );
  }

  async function getPoolData(pool: { fee: number, pool: string; }) {
    const poolContract = new ethers.Contract(pool.pool, POOL_ABI, signer);
    const [liquidityBn, slot0Data] = await Promise.all([
      poolContract.liquidity(),
      poolContract.slot0(),
    ]);

    return {
      address: pool.pool,
      fee: pool.fee,
      sqrtPriceX96: slot0Data[0].toString(),
      liquidity: liquidityBn.toString(),
    };
  }

  async function findPools(pools: Array<{ fee: number; pool: string; }>) {
    if (pools.length === 0) {
      return 'Pools not found';
    }

    const poolReserves = await Promise.all(pools.map(getPoolData));
    const sorted = poolReserves.sort((poolA, poolB) => Number(poolA.liquidity) - Number(poolB.liquidity));
    const mostLiquid = sorted[sorted.length - 1];

    if (!mostLiquid || !mostLiquid.liquidity) {
      throw new Error(
        `🍰 ❌ | Ликвидность в пулах не найдена: ${pools.map((pool) => pool.pool).join(', ')}`
      );
    }

    return mostLiquid;
  }

  async function getTokenBalance(tokenAddress: string) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const rawBalance = await tokenContract.balanceOf(signer.address);
    return formatToken(tokenAddress, rawBalance);
  }

  async function buyToken(
    tokenOut: string,
    nativeAmountStr: string,
    priorityFeeGwei: string,
    poolData: {
      fee: number;
      sqrtPriceX96: string;
    }
  ) {
    const amountOutMinimum = computeAmountOutMinSingleHop(
      poolData.sqrtPriceX96,
      DEFAULT_SLIPPAGE * 100
    );

    const walletNativeBalance = await provider.getBalance(signer.address);
    const gasPrice = ethers.parseUnits(priorityFeeGwei, 'gwei');
    const userPayAmount = parseEther(nativeAmountStr);
    const totalNeeded = userPayAmount + gasPrice; // для простоты считаем, что мы платим gasPrice поверх userPayAmount

    if (walletNativeBalance < totalNeeded) {
      throw new Error(
        `🍰 ❌ | Недостаточно ${network.name}: есть - ${walletNativeBalance}, нужно - ${totalNeeded}`
      );
    }

    await wrapNativeToken(totalNeeded, gasPrice);

    const wrappedContract = new ethers.Contract(network.wrappedNativeAddress, ERC20_ABI, signer);
    const userWrappedBalance = await wrappedContract.balanceOf(signer.address);
    await checkAndApproveToken(network.wrappedNativeAddress, network.routerAddress, userWrappedBalance, gasPrice);

    const routerContract = new ethers.Contract(network.routerAddress, ROUTER_ABI, signer);
    const deadline = getDeadline(5);
    const params = {
      tokenIn: network.wrappedNativeAddress,
      tokenOut,
      fee: poolData.fee ?? DEFAULT_FEE_TIER,
      recipient: signer.address,
      deadline,
      amountIn: userPayAmount,
      amountOutMinimum,
      sqrtPriceLimitX96: 0,
    };
    console.log(`🍰 ⓘ | Параметры:`, params);

    logAndNotify(
      `🍰 ⌛️ | Свап ${network.wrappedName} -> ${tokenOut} на сумму ${nativeAmountStr} ${network.wrappedName}...`
    );

    const swapTx = await routerContract.exactInputSingle(params, { gasPrice });
    logAndNotify(`🍰 ⌛️ | Транзакция свапа отправлена: ${swapTx.hash}`);
    const swapReceipt = await swapTx.wait();
    logAndNotify(
      `🍰 ✅ | Свап ${network.wrappedName} -> ${tokenOut} выполнен (блок: ${swapReceipt.blockNumber}). Тх: ${swapTx.hash}`
    );

    return swapReceipt;
  }

  async function sellToken(
    tokenIn: string,
    tokenAmountStr: string,
    priorityFeeGwei: string,
    poolData: {
      fee: number;
      sqrtPriceX96: string;
    }
  ) {
    const amountOutMinimum = computeAmountOutMinSingleHop(
      poolData.sqrtPriceX96,
      DEFAULT_SLIPPAGE * 100
    );

    const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
    const amountIn = await parseToken(tokenIn, tokenAmountStr);
    const currentBalance = await tokenContract.balanceOf(signer.address);
    if (currentBalance < amountIn) {
      throw new Error(
        `🍰 ❌ | Недостаточно токена ${tokenIn}: есть - ${currentBalance}, нужно - ${amountIn}`
      );
    }

    const gasPrice = ethers.parseUnits(priorityFeeGwei, 'gwei');
    await checkAndApproveToken(tokenIn, network.routerAddress, amountIn, gasPrice);

    const routerContract = new ethers.Contract(network.routerAddress, ROUTER_ABI, signer);
    const deadline = getDeadline(5);
    const params = {
      tokenIn,
      tokenOut: network.wrappedNativeAddress,
      fee: poolData.fee ?? DEFAULT_FEE_TIER,
      recipient: signer.address,
      deadline,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: poolData.sqrtPriceX96,
    };
    console.log(`🍰 ⓘ | Параметры:`, { ...params, gasPrice });
    logAndNotify(
      `🍰 ⌛️ | Свап ${tokenIn} -> ${network.wrappedName} на сумму ${tokenAmountStr}...`
    );

    const swapTx = await routerContract.exactInputSingle(params, { gasPrice });
    logAndNotify(`🍰 ⌛️ | Транзакция свапа отправлена: ${swapTx.hash}`);

    const swapReceipt = await swapTx.wait();
    logAndNotify(
      `🍰 ✅ | Свап ${tokenIn} -> ${network.wrappedName} выполнен (блок: ${swapReceipt.blockNumber}).`
    );

    const wrappedContract = new ethers.Contract(network.wrappedNativeAddress, ERC20_ABI, signer);
    const wrappedBalance = await wrappedContract.balanceOf(signer.address);
    await unwrapNativeToken(wrappedBalance, gasPrice);

    return swapReceipt;
  }

  return {
    getPairPools,
    findPools,
    getTokenBalance,
    buyToken,
    sellToken,
  };
}
