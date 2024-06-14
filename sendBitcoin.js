const bitcoin = require("bitcoinjs-lib");
const { ECPairFactory } = require("ecpair");
const ecc = require("tiny-secp256k1");
bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)


// configuration for mainnet
// const network = bitcoin.networks.bitcoin
// const MEMPOOL_URL = `https://mempool.space`

// configuration for testnet
const network = bitcoin.networks.testnet
const MEMPOOL_URL = `https://mempool.space/testnet`

const DUST_LIMIT = 546

const BitcoinAddressType = {
  Legacy: 'legacy',
  NestedSegwit: 'nested-segwit',
  NativeSegwit: 'native-segwit',
  Taproot: 'taproot',
  Invalid: 'invalid'
}

// Function to fetch unspent transaction outputs (UTXOs) for the fromAddress
async function getUTXOs(address) {
  const url = `${MEMPOOL_URL}/api/address/${address}/utxo`
  const response = await fetch(url)
  if (response.ok) {
    const utxo_array = await response.json()
    let confirmed = [], unconfirmed = []
    for (const i in utxo_array)
      utxo_array[i]['status']['confirmed'] ? confirmed.push(utxo_array[i]) : unconfirmed.push(utxo_array[i])
    return {
      success: true,
      confirmed: utxo_array.filter((elem) => elem?.status?.confirmed) || [],
      unconfirmed: utxo_array.filter((elem) => !elem?.status?.confirmed) || []
    }
  }
  else {
    return {
      success: false,
      confirmed: [],
      unconfirmed: []
    }
  }
}

// Function to get confirmed total balance of a bitcoin address
async function getConfirmedBalanceFromAddress(address) {
  const { confirmed } = await getUTXOs(address)
  let totalBalance = 0
  for (const i in confirmed)
    totalBalance += parseInt(confirmed[i]['value'])
  return totalBalance
}

async function getSatsbyte() {
  const url = `${MEMPOOL_URL}/api/v1/fees/recommended`
  const response = await fetch(url)
  if (response.ok) {
    const recommendedFees = await response.json()
    return {
      success: true,
      recommendedFees
    }
  }
  else {
    return {
      success: false,
      recommendedFees: {}
    }
  }
}

function getBitcoinAddressType(address) {
  // Regular expressions for different Bitcoin address types
  const legacyRegex = network === bitcoin.networks.bitcoin ? /^[1][a-km-zA-HJ-NP-Z1-9]{25,34}$/ : /^[m,n][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const nestedSegwitRegex = network === bitcoin.networks.bitcoin ? /^[3][a-km-zA-HJ-NP-Z1-9]{25,34}$/ : /^[2][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const nativeSegwitRegex = network === bitcoin.networks.bitcoin ? /^(bc1q)[0-9a-z]{39,59}$/ : /^(tb1q)[0-9a-z]{39,59}$/;
  const taprootRegex = network === bitcoin.networks.bitcoin ? /^(bc1p)[0-9a-z]{39,59}$/ : /^(tb1p)[0-9a-z]{39,59}$/;

  if (legacyRegex.test(address)) {
    return BitcoinAddressType.Legacy;
  } else if (nestedSegwitRegex.test(address)) {
    return BitcoinAddressType.NestedSegwit;
  } else if (nativeSegwitRegex.test(address)) {
    return BitcoinAddressType.NativeSegwit;
  } else if (taprootRegex.test(address)) {
    return BitcoinAddressType.Taproot;
  } else {
    return BitcoinAddressType.Invalid;
  }
}

function getAddressFromWIFandType(wif, type) {
  const keyPair = ECPair.fromWIF(wif);
  if (type === BitcoinAddressType.Legacy)
    return bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network }).address
  else if (type === BitcoinAddressType.NestedSegwit)
    return bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }),
      network
    }).address;
  else if (type === BitcoinAddressType.NativeSegwit)
    return bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }).address
  else if (type === BitcoinAddressType.Taproot)
    return bitcoin.payments.p2tr({
      internalPubkey: keyPair.publicKey.slice(1, 33),
      network
    }).address;
  else
    return "invalid"
}

function estimateTransactionSize(numInputs, numOutputs, type) {
  let inputSize, outputSize, baseSize = 10;

  switch (type) {
    case BitcoinAddressType.Legacy:
      inputSize = 148;
      outputSize = 34;
      break;
    case BitcoinAddressType.NestedSegwit:
      inputSize = 91;
      outputSize = 31;
      break;
    case BitcoinAddressType.NativeSegwit:
      inputSize = 68;
      outputSize = 31;
      break;
    case BitcoinAddressType.Taproot:
      inputSize = 58;
      outputSize = 43;
      break;
    default:
      throw new Error('Unknown transaction type');
  }

  return baseSize + (numInputs * inputSize) + (numOutputs * outputSize);
}

function estimateTransactionFee(numInputs, numOutputs, type, feeRate) {
  const txSize = estimateTransactionSize(numInputs, numOutputs, type);
  return txSize * feeRate;
}

async function transferBtc(fromAddressPairs, toAddress, satsbyte) {
}

// Function to send bitcoin from one address to another
// returns the txid when success, error msg when error
async function sendBtc(fromAddressPair, toAddress, amountInSats) {

  // validate address types
  const { address: fromAddress, wif: fromWIF } = fromAddressPair
  const fromAddressType = getBitcoinAddressType(fromAddress)
  if (fromAddressType === BitcoinAddressType.Invalid)
    return {
      success: false,
      result: "invalid fromAddress"
    }

  const toAddressType = getBitcoinAddressType(toAddress)
  if (toAddressType === BitcoinAddressType.Invalid)
    return {
      success: false,
      result: "invalid toAddress"
    }

  // first check if that address holds such balance
  const currentBalance = await getConfirmedBalanceFromAddress(fromAddress)
  if (amountInSats <= currentBalance)
    return {
      success: false,
      result: "insufficient balance"
    }

  // check if fromWIF matches the fromAddress
  const checkingFromAddress = getAddressFromWIFandType(fromWIF, fromAddressType);
  if (fromAddress !== checkingFromAddress)
    return {
      success: false,
      result: "fromAddress does not match with fromWIF"
    }

  // now building transactions based on address types
  const keyPair = ECPair.fromWIF(fromAddressPair.wif);
  const { confirmed } = await getUTXOs(fromAddress)
  const sortedUTXOs = confirmed.sort((a, b) => parseInt(a.value) - parseInt(b.value))

  // get current mempool state
  const { fastestFee: originalFastestFee } = await getSatsbyte()

  // this is just for testnet, regarding Motoswap mempool spamming... comment below line when on mainnet
  const fastestFee = originalFastestFee * 5

  // build transaction
  const txb = new bitcoin.TransactionBuilder(network);
  let totalInputSats = 0, inputUtxoCount = 0
  let estimatedTransactionFee = estimateTransactionFee(1, 1, toAddressType, fastestFee)
  let inputsAreEnough = false
  for (const i in sortedUTXOs) {
    const { txid, vout, value } = sortedUTXOs[i]
    txb.addInput(txid, vout)
    inputUtxoCount ++
    totalInputSats += value
    estimatedTransactionFee = estimateTransactionFee(inputUtxoCount, 2, toAddressType, fastestFee)
    if (totalInputSats >= amountInSats + estimatedTransactionFee) {
      inputsAreEnough = true
      txb.addOutput(toAddress, amountInSats)
      if (totalInputSats - amountInSats - estimatedTransactionFee > DUST_LIMIT) 
        txb.addOutput(fromAddress, totalInputSats - amountInSats - estimatedTransactionFee)
    }
  }

  if (!inputsAreEnough)
    return {
      success: false,
      result: "Input UTXOs are not enough to send..."
    }

  for (const i = 0; i < txb.__inputs.length; i++) {
    txb.sign(i, keyPair);
  }

  const tx = txb.build();
  const txHex = tx.toHex();

  // Broadcast the transaction (example using BlockCypher)
  const broadcastAPI = `${MEMPOOL_URL}/api/tx`
  const transactionId = await fetch(broadcastAPI, {
    method: "POST",
    body: txHex,
  })

  return {
    success: true,
    result: transactionId
  }

}

module.exports = {
  BitcoinAddressType,
  getUTXOs,
  getBitcoinAddressType,
  getConfirmedBalanceFromAddress,
  getSatsbyte,
  transferBtc,
  sendBtc,
};
