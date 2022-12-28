// Copyright 2022 DeltaDex

const {ethers} = require('ethers');
const { round, e } = require('mathjs');

const coreABI = require('../abi/OptionMaker.json');
const storageABI = require('../abi/OptionStorage.json');

const OptionMakerAddress = '0x9581899a5cD67b63Aac1bccE7eB2447627801076';
const OptionStorageAddress = '0xe6eb097B4e81bE155BB91e6686BF019e56b96EeC';

const DAIaddress = '0x91D35db3222c0b96B9791667bF1d617d500CB180';
const WETHaddress = '0xb63e54810B4e7A8047A5Edae1BdD3Ab4B0E7B698';
const MATICaddress = '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889';

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
  ID: null,
  amount: null,
  expiry: null,
  fees: null,
  perDay: null,
  hedgeFee: null,
  lastHedgeTimeStamp: null,
  nextHedgeTimeStamp: null,
  isClosed: null,
}

const Users = new Map();

let activeUsers = 0;
let positionsHedged = 0;
let initialUserBalance = 0;
let isInitialized = false;

console.log("initializing...");


// @dev main func
async function main() {
  try {
    initialUserBalance = await DAI.balanceOf(signer.address);
  } catch(err) {
    console.log(err);
    console.log("initialUserBalance error");
  }

  while(true) {
    try {
      let numberOfPairs = await getPairs();
      await getUsers(numberOfPairs);
      await savePositions(numberOfPairs);
    
      arrangePositions();

      try {
        await checkIfHedgeAvailable();
      } catch(err) {
        console.log("error - main");
      }

      output();

    } catch(err) {
      // console.log(err);
    }

    isInitialized = true;

    await sleep(1000);
  }
}


// @dev this will be slow if there are multiple positions to hedge in a single block => multithreading?
async function checkIfHedgeAvailable() {
  timeNow = Date.now() / 1e3;

  for (i = 0; i < Positions.length; i++) {
    if (timeNow > Positions[i].nextHedgeTimeStamp) {
      try {
        await hedgePosition(i);
      } catch(err) {
        // console.log(err);
        console.log("error line 112");
        Positions[i].nextHedgeTimeStamp = nextHedgeTimeStamp(Positions[i].perDay, Date.now() / 1e3);

        if(err.reason == 'execution reverted: Not enough balance to hedge, 123') {

          console.log('____________________________________________________');

          console.log('Hedge Failed');
          console.log('Pair Address', Positions[i].pairAddress);
          console.log('User Address', Positions[i].userAddress);
          console.log('Position ID', Positions[i].ID);

          console.log('Reason: Not enough balance to hedge (user)');

        } else {
          console.log(err.reason);
        }

      }
    } else {
      // pass
    }
  }
} 


async function hedgePosition(index) {
  let position = Positions[index];

  const pair = position.pairAddress;
  const user = position.userAddress;
  const ID = position.ID;

  let shouldHedge = await estimateTxCost(pair, user, ID, index);

  console.log('____________________________________________________');

  console.log("Hedging", shouldHedge);
  console.log("Pair Address: ", pair);
  console.log("User Address: ", user);
  console.log("Position ID: ", ID);
  console.log("Hedging: ", shouldHedge ? "YES" : "NO");

  if (shouldHedge) {
    try {
      const tx = await optionmaker.connect(signer).BS_HEDGE(pair, user, ID);
      await tx.wait();
      positionsHedged++;
      console.log("Hedging Position Success");

    } catch(err) {
      console.log("Hedging Failed - hedgePosition");
    }

  } else {
    console.log("=> Reason: fee is less than tx price");
  }
  position.nextHedgeTimeStamp = nextHedgeTimeStamp(position.perDay, Date.now() / 1e3);

}


async function estimateTxCost(pair, user, ID, positionIndex) {
  let gasPrice = await provider.getFeeData();
  let gasAmount = await optionmaker.estimateGas.BS_HEDGE(pair, user, ID);
  let fee = ethers.BigNumber.from(Positions[positionIndex].hedgeFee).toString() / 1e18;

  let txPrice = gasAmount.mul(gasPrice.gasPrice) / 1e18;
  let maticPrice = await getMATICprice();
  let txPriceDAI = txPrice * maticPrice;

  let shouldHedge;

  if (fee > txPriceDAI) {
    shouldHedge = true;
  } 
  else {
    shouldHedge = false;
  }

  return shouldHedge;
}


// get matic price in DAI
async function getMATICprice() {
  let price
  try {
    price = await optionmaker.getPrice(MATICaddress, DAIaddress);
  }
  catch(err) {
    console.log(err);
    console.log("error - getMATICprice");
  }

  wethPrice = ethers.BigNumber.from(price).toString() / 1e18;

  return wethPrice;
}


async function getUsers(numberOfPairs) {
  activeUsers = 0;
  for (i = 0; i < numberOfPairs; i++) {
    const pair = Pairs[i].address;

    try {
      const allUsers = await optionstorage.getUserAddressesInPair(pair);
      Pairs[i].users = [...new Set(allUsers)];
      activeUsers += Pairs[i].users.length;
    } 
    catch(err) {
      console.log(err);
      console.log("error - getUsers");
    }
  }
}


async function getPairs() {
  let numberOfPairs = await optionstorage.numOfPairs();

  if (Pairs.length < numberOfPairs) {
    for (i = 0; i < numberOfPairs; i++) {
      const _pair = Object.create(Pair);

      try {
        _pair.address = await optionstorage.returnPairAddress(i);
      }
      catch(err) {
        console.log(err);
        console.log("error - returnPairAddress");
      }
  
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
      let numberOfUserPositions;

      try {
        numberOfUserPositions = await optionstorage.userIDlength(user);
      } 
      catch(err) {
        console.log(err);
        console.log("error - numberOfUserPositions");
      }

      let getNumberOfUserPositionsDatabase = getNumberOfUserPositions(user);

      if (numberOfUserPositions > getNumberOfUserPositionsDatabase) {
        if (isInitialized == true) {
          console.log('____________________________________________________')
          console.log('New Option Replication Detected');
        }

        Users.set(user, numberOfUserPositions);

        for (ID = 0; ID < numberOfUserPositions; ID++) {

          let isClosed;
          try {
            isClosed = await optionstorage.getPositionStatus(pair, user, ID);
          }
          catch(err) {
            console.log(err);
            console.log("error - isClosed");
          }

          console.log('____________________________________________________')

          console.log("Pair Address:", pair);
          console.log("User Address:", user);
          console.log("Position ID:", ID);
          console.log("Active Position: ", isClosed);

          const position = Object.create(Position);

          if (isClosed == false) {
            let positionData;
            try {
              positionData = await optionstorage.BS_PositionParams(pair, user, ID);
            } 
            catch(err) {
              console.log(err);
              console.log("error - positionData");
            }

            position.pairAddress = pair;
            position.userAddress = user;
            position.ID = ID;
            position.amount = positionData[0];
            position.expiry = positionData[1];
            position.fees = positionData[2];
            position.perDay = positionData[3].toNumber();
            position.hedgeFee = positionData[4]
            position.lastHedgeTimeStamp = positionData[5].toNumber();
            position.nextHedgeTimeStamp = nextHedgeTimeStamp(position.perDay, position.lastHedgeTimeStamp);
            position.isClosed = false;

            Positions.push(position);
          } else {
            // pass
          }

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
  let earnedFees = await DAI.balanceOf(signer.address) - initialUserBalance;
  let nextHedge = (Positions[0].nextHedgeTimeStamp - (Date.now() / 1e3)) / 60;

  console.log('____________________________________________________')

  console.log('Number of token pairs in DeltaDex Core: ', Pairs.length.toString());
  console.log('Total Number of Option Contracts: ', Positions.length.toString());
  console.log('Total Number of active users: ', activeUsers.toString());
  console.log('Number of positions hedged: ', positionsHedged.toString());

  let timeToNextHedge = round(nextHedge, 2);
  if (timeToNextHedge < 1) {
    timeToNextHedge = timeToNextHedge * 60;
    console.log('Next hedge in %d seconds', round(timeToNextHedge, 2));
  } else {
    console.log('Next hedge in %d minutes', timeToNextHedge);
  }
  console.log('Fees earned hedging: ', (earnedFees / 1e18).toString());
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
