import { PublicKey } from '@solana/web3.js';
import { createMeteora } from './meteora';

(async () => {
  const meteora = createMeteora();
  const balance = await meteora.getBalance();

  console.log('User Solana Balance: ', balance);

  const USDC_SOL_POOL = new PublicKey('7zwc5JuKuyhgc1VELA59KGAY2xmd3HZGwJNLCfHXZP99');
  const dllmPool = await meteora.getDLMMPool(USDC_SOL_POOL);

  // swap 1 USDC to SOL
  await meteora.swap(dllmPool, {
    from: 'usdc',
    to: 'So11111111111111111111111111111111111111112',
    amount: 1,
    swapForY: true,
  });

  // swap 1 SOL to USDC
  // await meteora.swap(dllmPool, {
  //   from: 'sol',
  //   to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  //   amount: 1,
  //   swapForY: false,
  // });
})();
