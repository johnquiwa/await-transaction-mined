const rpc = require('ethrpc')

class Blockstream {
  constructor({ network }) {
    this.network = network;
  }

  connectToEthereumNode (connectionConfiguration) {
    return new Promise((resolve, reject) => {
      rpc.connect(connectionConfiguration, function (err) {
        if (err) {
          if(err.code === -32601) {
            resolve(rpc);
          }
          reject(new Error('Failed To Connect To Ethereum Node'))
        } else {
          resolve(rpc)
        }
      })
    })
  }

  initEthereumRpc() {
    const connectionConfiguration = {
      httpAddresses: [this.network],
      wsAddresses: [],
      ipcAddresses: [],
      networkID: 0,
      connectionTimeout: 3000, // optional, default 3000
      errorHandler: function (err) { /* out-of-band error */ },
    }

    return this.connectToEthereumNode(connectionConfiguration)
      .then((connectedEthRpc) => {
        this.connectedEthRpc = connectedEthRpc
      })
  }

  getBlockStream() {
    return this.connectedEthRpc.getBlockStream()
  }

  getTransactionReceipt(txHash) {
    return new Promise((resolve, reject) => {
      return this.connectedEthRpc.eth.getTransactionReceipt(txHash, (err, txReceiptWithDecodedLogs) => {
        if (err) {
          throw new Error(err);
        }

        resolve(txReceiptWithDecodedLogs)
        })
    })
  }

  subscribeAndCheckBlocks(tx) {
    let initialCheck = true
    return new Promise((resolve, reject) => {
      const blockAddedToken = this.blockstream.subscribeToOnBlockAdded((block) => {
        if (block.transactions.indexOf(tx) !== -1 || initialCheck) {
          initialCheck = false
          return this.getTransactionReceipt(tx)
            .then((txReceiptWithDecodedLogs) => {
              if (txReceiptWithDecodedLogs) {
                this.blockstream.unsubscribeFromOnBlockAdded(blockAddedToken)
                resolve(txReceiptWithDecodedLogs)
              }
            })
        }
      })
    })
  }

  getTransactionReceiptOrWaitForBlock(tx) {
      return this.getTransactionReceipt(tx)
        .then((txReceiptWithDecodedLogs) => {
          if (txReceiptWithDecodedLogs) {
            return(txReceiptWithDecodedLogs)
          }
          return this.subscribeAndCheckBlocks(tx);
        })
  }


  processReceipt(txReceiptWithDecodedLogs) {
    if (txReceiptWithDecodedLogs.error) {
      throw new Error(txReceiptWithDecodedLogs.message)
    }
    return txReceiptWithDecodedLogs
  }

  awaitTransactionMined(tx) {
    return this.initEthereumRpc()
      .then(() => {
        return this.getBlockStream()
      })
      .then((blockstream) => {
        this.blockstream = blockstream
        return this.getTransactionReceiptOrWaitForBlock(tx)
      })
      .then((txReceiptWithDecodedLogs) => this.processReceipt(txReceiptWithDecodedLogs))
  }
}

module.exports = Blockstream;