import { ethers, parseEther, parseUnits, formatUnits } from "ethers";
import { ETH_RPC_URL, ETH_PRIVATE_KEY } from "../config";

// Адреса Uniswap V2
const UNISWAP_FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

// === ABIs ===
// Factory (getPair)
const factoryAbi = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
];

// Pair (getReserves)
const pairAbi = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];

// Router (Uniswap V2) - для swapExactETHForTokens, swapExactTokensForETH
const routerAbi = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

// ERC20 (balanceOf, allowance, approve)
const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

// Создаём аналогичный «фабричный» метод
export const createUniswap = () => {
  if (!ETH_PRIVATE_KEY) {
    throw new Error("ETH_PRIVATE_KEY is required");
  }

  const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
  const wallet = new ethers.Wallet(ETH_PRIVATE_KEY, provider);

  async function getTokenDecimals(tokenAddress: string) {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const decimals: number = await tokenContract.decimals();

    return decimals;
  }

  const formatToken = async (token: string, amount: string) => {
    const decimals = await getTokenDecimals(token);

    return formatUnits(amount, decimals);
  };

  const praseToken = async (token: string, amount: string) => {
    const decimals = await getTokenDecimals(token);

    return parseUnits(amount, decimals);
  };

  const getPair = async (tokenA: string, tokenB: string) => {
    const factory = new ethers.Contract(UNISWAP_FACTORY_ADDRESS, factoryAbi, wallet);
    const pair = await factory.getPair(tokenA, tokenB);
    if (pair === ethers.ZeroAddress) {
      return "Pair not found";
    }
    return pair;
  };

  const getReserves = async (pair: string) => {
    const pairContract = new ethers.Contract(pair, pairAbi, wallet);
    const reserves = await pairContract.getReserves();
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();

    return {
      [token0]: await formatToken(token0, reserves[0]),
      [token1]: await formatToken(token1, reserves[1]),
    };
  };

  const swapETHForTokens = async (
    tokenB: string,
    ethAmount: string,
    priorityFee: string
  ) => {
    const router = new ethers.Contract(UNISWAP_ROUTER_ADDRESS, routerAbi, wallet);

    const ethBalance = await provider.getBalance(wallet.address);
    const amountInETH = parseEther(ethAmount);
    if (ethBalance < amountInETH) {
      throw new Error(`Insufficient ETH balance: have=${ethBalance}, need=${amountInETH}`);
    }

    const path = [WETH_ADDRESS, tokenB];
    const amounts = await router.getAmountsOut(amountInETH, path);
    const amountOutMin = amounts[amounts.length - 1];

    const to = wallet.address;
    const deadline = BigInt(Math.floor(Date.now() / 1000 + 60 * 5));

    const tx = await router.swapExactETHForTokens(
      amountOutMin,
      path,
      to,
      deadline,
      {
        value: amountInETH,
        gasPrice: ethers.parseUnits(priorityFee, "gwei"),
      }
    );

    console.log(`Swap ETH->Token tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Swap ETH->Token confirmed in block ${receipt.blockNumber}`);
    return receipt;
  };

  const swapTokensForETH = async (
    tokenA: string,
    tokenAmount: string,
    priorityFee: string
  ) => {
    const router = new ethers.Contract(UNISWAP_ROUTER_ADDRESS, routerAbi, wallet);
    const amountIn = await praseToken(tokenA, tokenAmount);

    const tokenAContract = new ethers.Contract(tokenA, erc20Abi, wallet);
    const balanceA = await tokenAContract.balanceOf(wallet.address);
    if (balanceA < amountIn) {
      throw new Error(`Insufficient token balance: have=${balanceA}, need=${amountIn}`);
    }

    const allowance = await tokenAContract.allowance(wallet.address, UNISWAP_ROUTER_ADDRESS);
    if (allowance < amountIn) {
      console.log(`Approving router to spend ${amountIn} of tokenA...`);
      const approveTx = await tokenAContract.approve(UNISWAP_ROUTER_ADDRESS, amountIn, {
        gasPrice: ethers.parseUnits(priorityFee, "gwei"),
      });
      await approveTx.wait();
      console.log("Approved successfully!");
    }

    const path = [tokenA, WETH_ADDRESS];
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
        gasPrice: ethers.parseUnits(priorityFee, "gwei"),
      }
    );

    console.log(`Swap Token->ETH tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Swap Token->ETH confirmed in block ${receipt.blockNumber}`);
    return receipt;
  };

  return {
    getPair,
    getReserves,
    swapETHForTokens,
    swapTokensForETH,
  };
};
