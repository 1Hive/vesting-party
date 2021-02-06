import { toMs } from './date-utils'

export function transformFactoryData(factory) {
  return {
    ...factory,
    parties: factory.parties.map(transformPartyData),
  }
}

function transformPartyData(party) {
  return {
    ...party,
    createdAt: toMs(party.createdAt),
    upfrontPct: BigInt(party.upfrontPct),
    vestingPeriod: toMs(party.vestingPeriod),
    vestingDurationInPeriods: parseInt(party.vestingDurationInPeriods),
    vestingCliffInPeriods: parseInt(party.vestingCliffInPeriods),
    totalAmountClaimed: BigInt(party.totalAmountClaimed || '0'),
    vestings: party.vestings.map(transformVestingData),
  }
}

function transformVestingData(vesting) {
  return {
    ...vesting,
    startTime: toMs(vesting.startTime),
    amount: BigInt(vesting.amount),
    periodsClaimed: parseInt(vesting.periodsClaimed),
    amountClaimed: BigInt(vesting.amountClaimed),
    claims: vesting.claims.map(transformClaimData),
  }
}

function transformClaimData(claim) {
  return {
    ...claim,
    createdAt: toMs(claim.createdAt),
    amount: BigInt(claim.amount),
  }
}
