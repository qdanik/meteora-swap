import { ethers, formatUnits, parseEther, parseUnits } from 'ethers';
import { BSC_PRIVATE_KEY, BSC_RPC_URL, RMQ_NOTIFY_QUEUE } from '../config';
import { RabbitMQConnection } from '../rabbit';

const BSC_FACTORY_ADDRESS = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const BSC_ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const WBNB_ADDRESS = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';

// ==== ABIs ====
// Factory
const getPairAbi = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];

const getReservesAbi = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
];

const routerAbi = [
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
];

// ERC20 ABI (для balanceOf, allowance, approve)
const erc20Abi = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)'
];

export const createPanCake = (mqConnection?: RabbitMQConnection) => {
  const logger = (text: string) => {
    if (mqConnection) {
      mqConnection?.sendToQueue(RMQ_NOTIFY_QUEUE, { text });
    }

    console.log(text);
  };

  if (!BSC_PRIVATE_KEY) {
    throw new Error(`🎂 ❌ | Неверный приватный ключ для BSC_PRIVATE`);
  }

  const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
  const wallet = new ethers.Wallet(BSC_PRIVATE_KEY, provider);

  async function getTokenDecimals(tokenAddress: string) {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const decimals: number = await tokenContract.decimals();

    return decimals;
  }

  const formatToken = async (token: string, amount: string) => {
    const decimals = await getTokenDecimals(token);

    return formatUnits(amount, decimals);
  };

  const parseToken = async (token: string, amount: string) => {
    const decimals = await getTokenDecimals(token);

    return parseUnits(amount, decimals);
  };

  const getPair = async (tokenA: string, tokenB: string) => {
    const factory = new ethers.Contract(BSC_FACTORY_ADDRESS, getPairAbi, wallet);
    const pair = await factory.getPair(tokenA, tokenB);

    if (pair === ethers.ZeroAddress) {
      return 'Pair not found';
    }
    return pair;
  };

  const getReserves = async (pair: string) => {
    const pairContract = new ethers.Contract(pair, getReservesAbi, wallet);
    const reserves = await pairContract.getReserves();
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();

    return {
      [token0]: await formatToken(token0, reserves[0]),
      [token1]: await formatToken(token1, reserves[1]),
    };
  };

  const getTokenBalance = async (token: string) => {
    const tokenContract = new ethers.Contract(token, erc20Abi, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);

    return await formatToken(token, balance);
  };

  const swapBNBForTokens = async (
    tokenB: string,
    amount: string,
    priorityFee: string
  ) => {
    const router = new ethers.Contract(BSC_ROUTER_ADDRESS, routerAbi, wallet);

    const walletBalance = await provider.getBalance(wallet.address);
    const amountInBNB = parseEther(amount);
    if (walletBalance < amountInBNB) {
      throw new Error(`Insufficient BNB balance: have=${walletBalance} need=${amountInBNB}`);
    }

    // WBNB -> tokenB
    const path = [WBNB_ADDRESS, tokenB];
    const amounts = await router.getAmountsOut(amountInBNB, path);
    const amountOutMin = amounts[amounts.length - 1];
    const to = wallet.address;
    const deadline = BigInt(Math.floor(Date.now() / 1000 + 60 * 5));

    logger(`🎂 ⌛️ | Свап <b>BNB</b> -> <b>${tokenB}</b> на <b>${amount} BNB</b>...`);

    const tx = await router.swapExactETHForTokens(
      amountOutMin,
      path,
      to,
      deadline,
      {
        value: amountInBNB,
        gasPrice: ethers.parseUnits(priorityFee, 'gwei'),
      }
    );

    logger(`🎂 ✅ | Свап <b>BNB</b> -> <b>${tokenB}</b> завершен!\nТранзакция: <code>${tx.hash}</code>`);

    console.log(`Swap BNB->Token sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Swap BNB->Token confirmed in block ${receipt.blockNumber}`);
    return receipt;
  };

  const swapTokensForBNB = async (
    tokenA: string,
    tokenAmount: string,
    priorityFee: string
  ) => {
    const router = new ethers.Contract(BSC_ROUTER_ADDRESS, routerAbi, wallet);
    const amountIn = await parseToken(tokenA, tokenAmount);
    const balanceA = await getTokenBalance(tokenA);

    if (parseFloat(balanceA) < parseFloat(tokenAmount)) {
      throw new Error(`Insufficient tokenA balance: have=${parseFloat(balanceA).toFixed(2)} need=${parseFloat(tokenAmount)}`);
    }

    const tokenContract = new ethers.Contract(tokenA, erc20Abi, wallet);
    const allowance = await tokenContract.allowance(wallet.address, BSC_ROUTER_ADDRESS);
    if (allowance < amountIn) {
      console.log(`Approving router to spend ${parseFloat(tokenAmount)} of tokenA...`);
      const approveTx = await tokenContract.approve(BSC_ROUTER_ADDRESS, amountIn, {
        gasPrice: ethers.parseUnits(priorityFee, 'gwei'),
      });
      await approveTx.wait();
      console.log(`Approved successfully!`);
    }

    const path = [tokenA, WBNB_ADDRESS];
    const amounts = await router.getAmountsOut(amountIn, path);
    const amountOutMin = amounts[amounts.length - 1];
    const to = wallet.address;
    const deadline = BigInt(Math.floor(Date.now() / 1000 + 60 * 5));

    const tx = await router.swapExactTokensForETH(
      amountIn,
      amountOutMin,
      path,
      to,
      deadline,
      {
        gasPrice: ethers.parseUnits(priorityFee, 'gwei'),
      }
    );

    console.log(`Swap Token->BNB sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Swap Token->BNB confirmed in block ${receipt.blockNumber}`);
    return receipt;
  };

  return {
    getPair,
    getReserves,
    swapBNBForTokens,
    swapTokensForBNB,
  };
};
