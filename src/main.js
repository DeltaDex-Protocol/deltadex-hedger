// require("@nomiclabs/hardhat-waffle");
// const {parseUnits} = require("ethers/lib/utils");
const {ethers} = require('ethers');

require("dotenv").config();

const coreABI = require('../abi/OptionMaker.json');
const storageABI = require('../abi/OptionStorage.json');

const OptionMakerAddress = '0x235E4A333CdD327D68De53d8457C4032EeEBCBF6';
const OptionStorageAddress = '0x74E7CF978C61685dB8527086CD66316Ce7aF295c';

const RPC = 'http://localhost:8545';
const provider = new ethers.providers.JsonRpcProvider(RPC);

const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const optionmaker = new ethers.Contract(OptionMakerAddress, coreABI, signer);
const optionstorage = new ethers.Contract(OptionStorageAddress, storageABI, signer);

// data types
const Pairs = [];

const Pair = {
  address: null,
  users: [],
}

const Positions = [];

const Position = {
  pairAddress: null,
  userAddress: null,
  type: null,
  ID: null,
  amount: null,
  expiry: null,
  fees: null,
  perDay: null,
  hedgeFee: null,
  lastHedgeTimeStamp: null,
  nextHedgeTimeStamp: null
}

const Users = new Map();

const User = {
  address: null,
  positions: null,
}

// @dev main func
async function main() {
  while(true) {
    let numberOfPairs = await getPairs();

    await getUsers(numberOfPairs);
    await savePositions(numberOfPairs);
  
    arrangePositions();

    await checkIfHedgeAvailable();

    output();

    await sleep(5000);
  }
}

// @dev this will be slow if there are multiple positions to hedge in a single block...
async function checkIfHedgeAvailable() {
  timestamp = Date.now();

  for (i = 0; i < Positions.length; i++) {
    if (timestamp < Positions[i].nextHedgeTimeStamp) {
      hedgePosition(i);
    } 
    else {
      // pass
    }
  }
} 


async function hedgePosition(index) {
  console.log("Hedging Position");

  let position = Positions[index];

  const pair = position.pairAddress;
  const user = position.userAddress;
  const ID = position.ID;

  if (position.type == "BS") {
    await optionmaker.BS_HEDGE(pair, user, ID);
  }
  else {
    await optionmaker.JDM_HEDGE(pair, user, ID);
  }
  position.nextHedgeTimeStamp = nextHedgeTimeStamp(position.perDay, Date.now());

  console.log("Hedging Position Sucess");
  
}


async function getUsers(numberOfPairs) {
  for (i = 0; i < numberOfPairs; i++) {
    const pair = Pairs[i].address;

    const allUsers = await optionstorage.getUserAddressesInPair(pair);
    Pairs[i].users = [...new Set(allUsers)];
  }
}


async function getPairs() {
  let numberOfPairs = await optionstorage.numOfPairs();

  if (Pairs.length < numberOfPairs) {
    for (i = 0; i < numberOfPairs; i++) {
      const _pair = Object.create(Pair);
  
      _pair.address = await optionstorage.returnPairAddress(i);
  
      Pairs.push(_pair);
    }
  }
  else {
    // pass 
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
      let getNumberOfUserPositionsDatabase = getNumberOfUserPositions(user);

      if (numberOfUserPositions > getNumberOfUserPositionsDatabase) {
        Users.set(user, numberOfUserPositions);

        for (ID = 0; ID < numberOfUserPositions; ID++) {

          let positionData = await optionstorage.BS_PositionParams(pair, user, ID);
          let type;

          if (positionData.amount == 0) {
            positionData = await optionstorage.JDM_PositionParams(pair, user, ID);
            type = "JDM";
          }
          else {
            type = "BS";
          }

          const position = Object.create(Position);

          position.pairAddress = pair;
          position.userAddress = user;
          position.type = type;
          position.ID = ID;
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
}


function getNumberOfUserPositions(user) {
  let numberOfPositions = Users.get(user);

  if (numberOfPositions == undefined) {
    numberOfPositions = 0;
  }

  return numberOfPositions;
}


function nextHedgeTimeStamp(perDay, lastHedgeTimeStamp) {
  interval = 86400 / perDay;
  nextTimeStamp = lastHedgeTimeStamp + interval;

  return nextTimeStamp;
}


function arrangePositions() {
  Positions.sort(compare);
}


function compare(a, b) {
  if (a.nextHedgeTimeStamp < b.nextHedgeTimeStamp){
    return -1;
  }
  if (a.nextHedgeTimeStamp > b.nextHedgeTimeStamp){
    return 1;
  }
  return 0;
}


function output() {
    console.log('Number of pairs in contract: ', Pairs.length.toString());
    console.log('Number of open positions: ', Positions.length.toString());
  }


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
