// require("@nomiclabs/hardhat-waffle");
// const {parseUnits} = require("ethers/lib/utils");
const {ethers} = require('ethers');
const { number } = require('mathjs');

require('dotenv').config();

const coreABI = require('../abi/OptionMaker.json');
const storageABI = require('../abi/OptionStorage.json');

const OptionMakerAddress = '0x235E4A333CdD327D68De53d8457C4032EeEBCBF6';
const OptionStorageAddress = '0x74E7CF978C61685dB8527086CD66316Ce7aF295c';

const RPC = 'http://localhost:8545';
const provider = new ethers.providers.JsonRpcProvider(RPC);

const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const optionstorage = new ethers.Contract(OptionStorageAddress, storageABI, signer);

// data types
const Pairs = [];

// @dev object bc I might add more data later
const Pair = {
  address: null,
}

const Positions = [];

/*
K = BS_Options[pair][user][ID].parameters.K;
T = BS_Options[pair][user][ID].parameters.T;
r = BS_Options[pair][user][ID].parameters.r;
sigma = BS_Options[pair][user][ID].parameters.sigma;
isCall = BS_Options[pair][user][ID].isCall;
return (K,T,r,sigma,isCall);
*/


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
  nextHedgeTimeStamp: null,
  OptionParams: {},
}

const OptionParams = {
  K: null,
  T: null,
  r: null,
  sigma: null,
  m: null,
  v: null,
  lam: null,
  isCall: null,
}

// @dev main func
async function main() {
  let userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  let numberOfPairs = await getPairs(userAddress);

  console.log("number of pairs", numberOfPairs);

  await getUserPostions(userAddress, numberOfPairs);

  console.log("Positions script length", Positions.length);

  printPositions();
}

async function getUserPostions(userAddress, numberOfPairs) {
  // let numberOfUserPositions = await optionstorage.userIDlength(userAddress);

  let ID = 0;

  for (let pair = 0; pair < numberOfPairs; pair++) {

    let pairAddress = Pairs[pair].address;

    let positionData = await optionstorage.BS_PositionParams(pairAddress, userAddress, ID);
    let type;

    if (positionData.amount == 0) {
    positionData = await optionstorage.JDM_PositionParams(pairAddress, userAddress, ID);
    type = "JDM";
    }
    else {
    type = "BS";
    }

    const position = Object.create(Position);

    position.pairAddress = pairAddress;
    position.userAddress = userAddress;
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

    ID++;
  }   
}


async function getPairs(userAddress) {
  let PairAddresses = await optionstorage.getUserPositions(userAddress);

  console.log("pair addresses", PairAddresses);

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
