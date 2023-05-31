import { TransferEvent, Message, Token, TokenTransfer, Transaction } from '../types'
import { CosmosEvent, CosmosBlock, CosmosMessage, CosmosTransaction } from '@subql/types-cosmos'

export async function handleBlock(block: CosmosBlock): Promise<void> {
  const { time, height, chainId } = block.block.header
  const { txs } = block

  for (let i = 0; i < txs.length; i++) {
    const { code, gasUsed } = txs[i]

    const t = Transaction.create({
      id: `${height}-${i}`,
      blockHeight: height,
      timestamp: BigInt(time.valueOf()),
      chainId,
      gasUsed: BigInt(gasUsed),
      status: code === 0 ? 'success' : 'failed',
    })
    await t.save()
  }
}

type IssueMsg = {
  issuer: string
  symbol: string
  subunit: string
  precision: number
  initialAmount: string
  description: string
  features: string[]
  burnRate: string
  sendCommissionRate: string
}

export async function handleTokenIssuance(msg: CosmosMessage<IssueMsg>): Promise<void> {
  logger.info(`${JSON.stringify(msg.msg.decodedMsg)}`)
  const { subunit, features, issuer } = msg.msg.decodedMsg
  const token = Token.create({
    id: `${subunit}-${issuer}`,
    ...msg.msg.decodedMsg,
    features: JSON.stringify(features),
    chainId: msg.block.header.chainId,
  })
  await token.save()
}

/*
export async function handleTransaction(tx: CosmosTransaction): Promise<void> {
  // If you want to index each transaction in Cosmos (CosmosHub), you could do that here
  const transactionRecord = Transaction.create({
    id: tx.hash,
    blockHeight: BigInt(tx.block.block.header.height),`
    timestamp: tx.block.block.header.time,
  });
  await transactionRecord.save();
}
*/

type TransferMsg = {
  fromAddress: string
  toAddress: string
  amount: {
    denom: string
    amount: string
  }[]
}

export async function handleTransferMessage(msg: CosmosMessage<TransferMsg>): Promise<void> {
  const { height, chainId } = msg.block.block.header

  const { amount } = msg.msg.decodedMsg

  const messageRecord = Message.create({
    id: `${msg.tx.hash}-${msg.idx}`,
    blockHeight: height,
    chainId,
    txHash: msg.tx.hash,
    from: msg.msg.decodedMsg.fromAddress,
    to: msg.msg.decodedMsg.toAddress,
    amount: JSON.stringify(msg.msg.decodedMsg.amount),
  })
  await messageRecord.save()

  const tokens = []
  for (const { denom } of amount) {
    const token = await Token.get(denom)
    if (token) {
      tokens.push(token)
    }
  }
  for (const token of tokens) {
    const tokenTransfer = TokenTransfer.create({
      ...messageRecord,
      tokenId: token.id,
      status: msg.tx.tx.code === 0 ? 'success' : 'failed',
      gasUsed: BigInt(msg.tx.tx.gasUsed),
    })
    await tokenTransfer.save()
  }
}
