// require("@nomiclabs/hardhat-waffle");
// const {parseUnits} = require("ethers/lib/utils");
const {ethers} = require('ethers');
require('dotenv').config();

// const coreABI = require('../abi/OptionMaker.json');
const storageABI = require('../abi/OptionStorage.json');

// const OptionMakerAddress = '0x235E4A333CdD327D68De53d8457C4032EeEBCBF6';
const OptionStorageAddress = '0x1D006bf51E1C032F4f754EE38786450ba0f78e29';

async function main() {
  const RPC = 'http://localhost:8545';
  const provider = new ethers.providers.JsonRpcProvider(RPC);

  // const core = new ethers.Contract(OptionMakerAddress, coreABI, provider);
  const optionstorage = new ethers.Contract(OptionStorageAddress, storageABI, provider);

  // const signer = new ethers.Wallet(process.env.PRIVATE_KEY_1, provider);
  // console.log(signer);

  const numberOfPairs = await optionstorage.numOfPairs();
  console.log('number of pairs in contract: ', numberOfPairs);

  const Pairs = [];

  const Pair = {
    address: null,
    users: []
  }

  for (i = 0; i < numberOfPairs; i++) {
    const _pair = Object.create(Pair);

    _pair.address = await optionstorage.returnPairAddress(i);

    Pairs.push(_pair);
    console.log(Pairs);
  }

  for (i = 0; i < numberOfPairs; i++) {
    const pair = Pairs[i].address;

    Pairs[i].users = await optionstorage.getUserAddressesInPair(pair);

    console.log("Users\n")
    console.log(Pairs[0].users);

    console.log("Pair Address:\n")
    console.log(Pairs[0].address);


  }




/* 
  // get users in pair

  for (i = 0; i < numberOfPairs; i++) {
    const pair = pairAddresses[i];
    const numberOfUsers = await optionstorage.getNumberOfUsersInPair(pair);

    

  }

  

  const numberOfUsers = await optionstorage.getNumberOfUsersInPair(pair);

  const userAddresses = [];
  for (i = 0; i < numberOfUsers)

 */


}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
