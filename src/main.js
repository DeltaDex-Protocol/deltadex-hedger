// require("@nomiclabs/hardhat-waffle");
const { parseUnits } = require("ethers/lib/utils");
const { ethers } = require("ethers");
require('dotenv').config()

const coreABI = require("../abi/OptionMaker.json");
const storageABI = require("../abi/OptionStorage.json");

const OptionMakerAddress = "0x774372fB7c8D6e484dbc7AE9c0f7771F070C30Db";
const OptionStorageAddress = "0x9B47985963fC82D8DEa6D824d1FbbFf3be5ca647";


async function main() {
  const RPC = "http://localhost:8545";
  const provider = new ethers.providers.JsonRpcProvider(RPC);

  const core = new ethers.Contract(OptionMakerAddress, coreABI, provider);
  const optionstorage = new ethers.Contract(OptionStorageAddress, storageABI, provider);

  // const account = await ethers.getSigners(process.env.PRIVATE_KEY_1);

  const positions = await optionstorage.numOfPairs();

  console.log("number of pairs in contract: ", positions);


  console.log(process.env.PRIVATE_KEY_1);



  
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
