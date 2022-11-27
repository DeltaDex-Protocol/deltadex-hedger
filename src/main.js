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

const Positions = [];

const Position = {
  amount: null,
  expiry: null,
  fees: null,
  perDay: null,
  hedgeFee: null,
  lastHedgeTimeStamp: null,
  nextHedgeTimeStamp: null
}


async function main() {
  let numberOfPairs = await getPairs();

  await getUsers(numberOfPairs);
  await savePositions(numberOfPairs);

  await printPositions();

}


async function getUsers(numberOfPairs) {

  for (i = 0; i < numberOfPairs; i++) {
    const pair = Pairs[i].address;

    const allUsers = await optionstorage.getUserAddressesInPair(pair);
    Pairs[i].users = [...new Set(allUsers)];
    
    /*     
    console.log("Users\n")
    console.log(Pairs[0].users);

    console.log("Pair Address:\n")
    console.log(Pairs[0].address);
    */
  }
}


async function getPairs() {
  let numberOfPairs = await optionstorage.numOfPairs();
  console.log('number of pairs in contract: ', numberOfPairs);

  for (i = 0; i < numberOfPairs; i++) {
    const _pair = Object.create(Pair);

    _pair.address = await optionstorage.returnPairAddress(i);

    Pairs.push(_pair);
    console.log(Pairs);
  }

  return numberOfPairs;
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
        position.perDay = positionData[3].toNumber();
        position.hedgeFee = positionData[4]
        position.lastHedgeTimeStamp = positionData[5].toNumber();

        position.nextHedgeTimeStamp = nextHedgeTimeStamp(position.perDay, position.lastHedgeTimeStamp);

        Positions.push(position);
      }
    }
  }  
}


function nextHedgeTimeStamp(perDay, lastHedgeTimeStamp) {
  interval = 86400 / perDay;
  nextTimeStamp = lastHedgeTimeStamp + interval;

  return nextTimeStamp;
}

// @dev this is a test function
function printPositions() {
  for (i = 0; i < Positions.length; i++) {
    console.log(Positions[i]);
  }
}




main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
