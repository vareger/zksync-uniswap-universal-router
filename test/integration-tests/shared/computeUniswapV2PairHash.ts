import { calculateInitCodeHash } from './deployUniswapV2'

async function main() {
  const initCodeHash = await calculateInitCodeHash()
  console.log(initCodeHash)
}

main()
