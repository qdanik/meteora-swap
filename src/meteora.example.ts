import { createMeteora } from './meteora';

(async () => {
  const meteora = createMeteora();
  const balance = await meteora.getBalance();

  console.log('User Solana Balance: ', balance);

  // swap 1 USDC to SOL
  await meteora.swap(
    '7zwc5JuKuyhgc1VELA59KGAY2xmd3HZGwJNLCfHXZP99',
    'USDC',
    'SOL',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'So11111111111111111111111111111111111111112',
    1,
  );

  // swap 1 SOL to USDC
  // await meteora.swap(
  //   '7zwc5JuKuyhgc1VELA59KGAY2xmd3HZGwJNLCfHXZP99',
  //   'USDC',
  //   'SOL',
  //   'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  //   'So11111111111111111111111111111111111111112',
  //   1,
  //   false,
  // );
})();
