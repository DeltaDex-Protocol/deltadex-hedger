require("@nomiclabs/hardhat-waffle");
require('dotenv').config();

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: `https://polygon-rpc.com`,
      },
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [
        `${process.env.RINKEBY_PRIVATE_KEY_1}`,
        `${process.env.RINKEBY_PRIVATE_KEY_2}`,
        `${process.env.RINKEBY_PRIVATE_KEY_3}`,
      ],
      gasLimit: 25 * 10 ** 6,
    },
    matic: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.POLYGON_API_KEY}`,
      accounts: [
        `${process.env.RINKEBY_PRIVATE_KEY_1}`,
        `${process.env.RINKEBY_PRIVATE_KEY_2}`,
        `${process.env.RINKEBY_PRIVATE_KEY_3}`,
      ],
      gasLimit: 25 * 10 ** 6,
    },
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
};