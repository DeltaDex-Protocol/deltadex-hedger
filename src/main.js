// require("@nomiclabs/hardhat-waffle");
// const {parseUnits} = require("ethers/lib/utils");
const {ethers} = require('ethers');
require('dotenv').config();

// const coreABI = require('../abi/OptionMaker.json');
const storageABI = require('../abi/OptionStorage.json');

// const OptionMakerAddress = '0x235E4A333CdD327D68De53d8457C4032EeEBCBF6';
const OptionStorageAddress = '0x232A4710D1A21AfEfB021654C5B48092e5faB67F';

const RPC = 'http://localhost:8545';
const provider = new ethers.providers.JsonRpcProvider(RPC);

// const core = new ethers.Contract(OptionMakerAddress, coreABI, provider);
const optionstorage = new ethers.Contract(OptionStorageAddress, storageABI, provider);

// const signer = new ethers.Wallet(process.env.PRIVATE_KEY_1, provider);
// console.log(signer);


const Pairs = [];

const Pair = {
  address: null,
  users: []
}


async function main() {
  let numberOfPairs = await optionstorage.numOfPairs();
  console.log('number of pairs in contract: ', numberOfPairs);

  for (i = 0; i < numberOfPairs; i++) {
    const _pair = Object.create(Pair);

    _pair.address = await optionstorage.returnPairAddress(i);

    Pairs.push(_pair);
    console.log(Pairs);
  }

  for (i = 0; i < numberOfPairs; i++) {
    const pair = Pairs[i].address;

    const allUsers = await optionstorage.getUserAddressesInPair(pair);
    Pairs[i].users = [...new Set(allUsers)];
    
    console.log("Users\n")
    console.log(Pairs[0].users);

    console.log("Pair Address:\n")
    console.log(Pairs[0].address);

  }

  await savePositions(numberOfPairs);

}


async function savePositions(numberOfPairs) {

  /* 
    IMPORTANT DATA FOR HEDGING
    uint amount;
    uint expiry;
    uint fees;
    uint perDay;
    uint hedgeFee;
    uint lastHedgeTimeStamp;
  */
  
  const Positions = [];

  const Position = {
    amount: null,
    expiry: null,
    fees: null,
    perDay: null,
    hedgeFee: null,
    lastHedgeTimeStamp: null
  }

  // Getting all positions of all users
  for (i = 0; i < numberOfPairs; i++) {

    let pair = Pairs[i].address;

    let users = Pairs[i].users;

    for (j = 0; j < users.length; j++) {

      let user = users[j];

      let numberOfUserPositions = await optionstorage.userIDlength(user);

      for (ID = 0; ID < numberOfUserPositions; ID++) {

        let positionData = await optionstorage.BS_PositionParams(pair, user, ID);

        if (positionData.amount == 0) {
          positionData = await optionstorage.JDM_PositionParams(pair, user, ID);
        }

        const position = Object.create(Position);

        position.amount = positionData[0];
        position.expiry = positionData[1];
        position.fees = positionData[2];
        position.perDay = positionData[3];
        position.hedgeFee = positionData[4];
        position.lastHedgeTimeStamp = positionData[5];

        Positions.push(position);
      }
    }
  }  
}





main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
