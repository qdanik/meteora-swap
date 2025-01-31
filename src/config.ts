import dotenv from 'dotenv';

dotenv.config();

export const SOL_PRIVATE_KEY = process.env.SOL_PRIVATE_KEY;
export const SOL_RPC_URL = process.env.SOL_RPC_URL;

export const DEFAULT_USDC_AMOUNT = Number(process.env.DEFAULT_USDC_AMOUNT);
export const DEFAULT_SOL_AMOUNT = Number(process.env.DEFAULT_SOL_AMOUNT);
export const DEFAULT_SLIPPAGE = Number(process.env.DEFAULT_SLIPPAGE);

export const RMQ_HOST = process.env.RMQ_HOST;
export const RMQ_PORT = process.env.RMQ_PORT;
export const RMQ_USER = process.env.RMQ_USER;
export const RMQ_PASS = process.env.RMQ_PASS;
export const RMQ_TX_QUEUE = process.env.RMQ_TX_QUEUE;
export const RMQ_NOTIFY_QUEUE = process.env.RMQ_NOTIFY_QUEUE;