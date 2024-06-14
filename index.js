const { getUTXOs, getSatsbyte, getConfirmedBalanceFromAddress, sendBtc } = require('./sendBitcoin')

const test_getUTXOs = async () => {
  const { success, confirmed, unconfirmed } = await getUTXOs('bc1pudsspvxgvclznfu5lkxezexvta48pgnu407gw4fce0t9yawaqm6sxdjhed')
  console.log(success)
  console.log(confirmed.length)
  console.log(unconfirmed.length)
}

const test_getSatsbyte = async () => {
  const { success, recommendedFees } = await getSatsbyte()
  console.log(success)
  console.log(recommendedFees)
}

const test_getConfirmedBalanceFromAddress = async () => {
  const balance = await getConfirmedBalanceFromAddress('3QFtYbR22en2AizTb7JVFA9bL2rf1fbNJr')
  console.log(balance)
}

const test_sendBtc = async () => {
  const wif = 'L4AcCP9QMdF7ppvrVa63FSyyceBeYtVJEDEKquHX9J2sykNdJB1r'
  const address = 'tb1prpy8zgz27lk2x3ndj8re4kygvq5qeptzh9rszphv0vveazvfxs2q32ze5x'
  const toAddress = 'tb1pudsspvxgvclznfu5lkxezexvta48pgnu407gw4fce0t9yawaqm6s39ycrz'
  const amountInSats = 50000
  const result = await sendBtc({
    wif,
    address
  }, toAddress, amountInSats)
  console.log(result)
}
// test_getUTXOs()
// test_getSatsbyte()
// test_getConfirmedBalanceFromAddress()
test_sendBtc()