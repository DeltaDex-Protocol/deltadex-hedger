// require("@nomiclabs/hardhat-waffle");
// const {parseUnits} = require("ethers/lib/utils");
const {ethers} = require('ethers');
const { number } = require('mathjs');

require('dotenv').config();

const coreABI = require('../abi/OptionMaker.json');
const storageABI = require('../abi/OptionStorage.json');

const OptionMakerAddress = '0xd7a89AEa304A491Ef4B5e74928370059fa53D8C6';
const OptionStorageAddress = '0x232A4710D1A21AfEfB021654C5B48092e5faB67F';

const RPC = 'http://localhost:8545';
const provider = new ethers.providers.JsonRpcProvider(RPC);

const signer = new ethers.Wallet(process.env.PRIVATE_KEY_1, provider);

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


// @dev main func
async function main() {
    let userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

    let numberOfPairs = await getPairs(userAddress);

    console.log(numberOfPairs);

    await getUserPostions(userAddress, numberOfPairs);

    printPositions();
}

async function getUserPostions(userAddress, numberOfPairs) {

    let numberOfUserPositions = await optionstorage.userIDlength(userAddress);

    for (let pair = 0; pair < numberOfPairs; pair++) {

        let pairAddress = Pairs[pair].address;

        for (ID = 0; ID < numberOfUserPositions; ID++) {

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
        }
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
