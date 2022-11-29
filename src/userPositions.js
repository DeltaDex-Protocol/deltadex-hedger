// Copyright 2022 DeltaDex
const {ethers} = require('ethers');

const storageABI = require('../abi/OptionStorage.json');

const OptionStorageAddress = '0x74E7CF978C61685dB8527086CD66316Ce7aF295c';

const RPC = 'http://localhost:8545';
const provider = new ethers.providers.JsonRpcProvider(RPC);

require("dotenv").config();
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const optionstorage = new ethers.Contract(OptionStorageAddress, storageABI, signer);

// data types
const Pairs = [];

// @dev object bc I might add more data later
const Pair = {
  address: null,
}

const Positions = [];

const Position = {
  pairAddress: null,
  userAddress: null,
  ID: null,

  addressTokenA: null,
  addressTokenB: null,
  tokenA_balance: null,
  tokenB_balance: null,
  isCall: null,
  isLong: null,

  amount: null,
  expiry: null,
  fees: null,
  perDay: null,
  hedgeFee: null,

  lastHedgeTimeStamp: null,
  nextHedgeTimeStamp: null,

  K: null,
  T: null,
  r: null,
  sigma: null,
  isCall: null,
}


// @dev main func
async function main() {
  let userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  let numberOfPairs = await getPairs(userAddress);
  await getUserPostions(userAddress, numberOfPairs);

  printPositions();
}


async function getUserPostions(userAddress, numberOfPairs) {
  let ID = 0;

  for (let pair = 0; pair < numberOfPairs; pair++) {

    let pairAddress = Pairs[pair].address;

    let positionData = await optionstorage.BS_PositionParams(pairAddress, userAddress, ID);
    let optionParams = await optionstorage.BS_getDeltaParams(pairAddress, userAddress, ID);

    const position = Object.create(Position);

    position.pairAddress = pairAddress;
    position.userAddress = userAddress;
    position.ID = ID;

    position.amount = positionData[0];
    position.expiry = positionData[1];
    position.fees = positionData[2];
    position.perDay = positionData[3].toNumber();
    position.hedgeFee = positionData[4];

    position.lastHedgeTimeStamp = positionData[5].toNumber();
    position.nextHedgeTimeStamp = nextHedgeTimeStamp(position.perDay, position.lastHedgeTimeStamp);

    position.K = optionParams[0],
    position.T = optionParams[1],
    position.r = optionParams[2],
    position.sigma = optionParams[3],
    position.isCall = optionParams[4],

    Positions.push(position);

    ID++;
  }
}


async function getPairs(userAddress) {
  let PairAddresses = await optionstorage.getUserPositions(userAddress);

  for (i = 0; i < PairAddresses.length; i++) {
    const _pair = Object.create(Pair);

    _pair.address = PairAddresses[i];

    Pairs.push(_pair);
  }

  return PairAddresses.length;
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
