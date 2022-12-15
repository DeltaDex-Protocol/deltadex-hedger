// Copyright 2022 DeltaDex

const {ethers} = require('ethers');
const { round } = require('mathjs');

const coreABI = require('../abi/OptionMaker.json');
const storageABI = require('../abi/OptionStorage.json');

const OptionMakerAddress = '0x6031218C4d39Fa8d329921e89ee0A09771c8c272';
const OptionStorageAddress = '0x2fdF3B84D1b6209AD51ceEBCCe2ab1478e121148';
const DAIaddress = '0x6b89AeD87F8212bBc24C17687F020a2eD7DC3b9f';

const RPC = 'https://rpc.ankr.com/polygon_mumbai';
const provider = new ethers.providers.JsonRpcProvider(RPC);

require("dotenv").config();
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const optionmaker = new ethers.Contract(OptionMakerAddress, coreABI, signer);
const optionstorage = new ethers.Contract(OptionStorageAddress, storageABI, signer);

const daiABI = [
  // Read-Only Functions
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",

  // Authenticated Functions
  "function transfer(address to, uint amount) returns (bool)",

  // Events
  "event Transfer(address indexed from, address indexed to, uint amount)"
];

const DAI = new ethers.Contract(DAIaddress, daiABI, signer);


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


let positionsHedged = 0;


// @dev main func
async function main() {
  while(true) {

    try {

      let numberOfPairs = await getPairs();

      await getUsers(numberOfPairs);
      await savePositions(numberOfPairs);
    
      arrangePositions();

      await checkIfHedgeAvailable();
  
      output();

    } catch(err) {
      console.log(err);
    }

    await sleep(20000);
  }
}


// @dev this will be slow if there are multiple positions to hedge in a single block => multithreading?
async function checkIfHedgeAvailable() {
  timeNow = Date.now() / 1e3;

  /*   
  console.log("timeNow", timeNow);
  console.log("nextHedgeTimeStamp", Positions[0].nextHedgeTimeStamp);
  */

  for (i = 0; i < Positions.length; i++) {
    if (timeNow > Positions[i].nextHedgeTimeStamp) {
      hedgePosition(i);
    } 
    else {
      // pass
    }
  }
} 


async function hedgePosition(index) {
  let position = Positions[index];

  const pair = position.pairAddress;
  const user = position.userAddress;
  const ID = position.ID;

  let shouldHedge = estimateTxCost(pair, user, ID, index);

  if (shouldHedge) {
    try {
      await optionmaker.BS_HEDGE(pair, user, ID);
    } catch(err) {
      console.log("Hedging Failed");
      console.log(err);
    }
    console.log("Hedging Position Success");
    positionsHedged++;
  } else {
    console.log("fee is less than tx price: DON'T HEDGE");
  }

  position.nextHedgeTimeStamp = nextHedgeTimeStamp(position.perDay, Date.now());
  
}

async function estimateTxCost(pair, user, ID, positionIndex) {

  let gasPrice = await provider.getFeeData();
  let gasAmount = await optionmaker.estimateGas.BS_HEDGE(pair, user, ID);
  let fee = ethers.BigNumber.from(Positions[positionIndex].hedgeFee).toString() / 1e18;

  let txPrice = gasAmount.mul(gasPrice.gasPrice) / 1e18;

  let maticPrice = await getETHprice();

  let txPriceDAI = txPrice * maticPrice;

  let shouldHedge;

  if (fee > txPriceDAI) {
    console.log("fee", fee);
    console.log("txPriceDAI", txPriceDAI);
    console.log("fee is greater than tx price: HEDGE");

    shouldHedge = true;
  } else {
    console.log("fee", fee);
    console.log("txPriceDAI", txPriceDAI);
    console.log("fee is less than tx price: DONT HEDGE");

    shouldHedge = false;
  }

  return shouldHedge;
}

/* 
// function that gets the gas price of the current block
async function gasPrice(pair, user, ID) {
  let price = await provider.getFeeData();
  console.log("gas price", price.gasPrice.toNumber());
}
*/


// get matic price in DAI
async function getETHprice() {
  let MATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  let price = await optionmaker.getPrice(MATIC, DAIaddress);

  maticPrice = ethers.BigNumber.from(price).toString() / 1e18;

  return maticPrice;
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


async function output() {
  let balanceOf = await DAI.balanceOf('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');

  console.log('time now', (Date.now() / 1e3));
  console.log('next hedge', Positions[0].nextHedgeTimeStamp);

  let nextHedge = (Positions[0].nextHedgeTimeStamp - (Date.now() / 1e3)) / 60;

  console.log('Number of pairs in contract: ', Pairs.length.toString());
  console.log('Number of open positions: ', Positions.length.toString());
  console.log('Next hedge in %d minutes', round(nextHedge, 2));
  console.log('Number of positions hedged:', positionsHedged);

  console.log('Dai balance of User: ', (balanceOf / 1e18).toString());
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
