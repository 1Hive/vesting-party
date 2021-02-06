import { BigInt, Address } from "@graphprotocol/graph-ts";
import { ERC20 as ERC20Contract } from "../generated/PartyFactory/ERC20";
import { NewParty } from "../generated/PartyFactory/PartyFactory";
import {
  PartyJoined,
  VestingAdded,
  VestingBeneficiaryTransfered,
  VestingTokensClaimed,
  Party as PartyContract,
} from "../generated/templates/Party/Party";
import {
  User,
  Party,
  PartyFactory,
  Vesting,
  Claim,
  ERC20,
} from "../generated/schema";
import { Party as PartyTemplate } from "../generated/templates";

export function handleNewParty(event: NewParty): void {
  const factory = loadOrCreateFactory(event.address);
  const party = loadOrCreateParty(event.params.party);
  const partyContract = PartyContract.bind(event.params.party);

  const token = partyContract.token();

  factory.count = factory.count + 1;

  party.createdAt = event.block.timestamp;
  party.factory = factory.id;
  party.host = event.transaction.from;
  party.token = buildERC20(token);
  party.merkleRoot = partyContract.merkleRoot();
  party.name = partyContract.name();
  party.symbol = partyContract.symbol();
  party.upfrontPct = partyContract.upfrontVestingPct();
  party.vestingPeriod = partyContract.vestingPeriod();
  party.vestingDurationInPeriods = partyContract.vestingDuration();
  party.vestingCliffInPeriods = partyContract.vestingCliff();
  party.totalAmountClaimed = BigInt.fromI32(0);

  factory.save();
  party.save();

  PartyTemplate.create(event.params.party);
}

export function handlePartyJoined(event: PartyJoined): void {}

export function handleVestingAdded(event: VestingAdded): void {
  const partyContract = PartyContract.bind(event.address);

  const vestingId = buildVestingId(event.address, event.params.tokenId);
  const vesting = loadOrCreateVesting(vestingId);

  vesting.tokenId = event.params.tokenId;
  vesting.party = event.address.toHex();
  vesting.startTime = event.block.timestamp;
  vesting.beneficiary = partyContract
    .getVestingBeneficiary(event.params.tokenId)
    .toHex();
  vesting.amount = partyContract.getVestingAmount(event.params.tokenId);
  vesting.periodsClaimed = 0;
  vesting.amountClaimed = BigInt.fromI32(0);

  vesting.save();
}

export function handleVestingTokensClaimed(event: VestingTokensClaimed): void {
  const party = loadOrCreateParty(event.address);
  const partyContract = PartyContract.bind(event.address);

  const vestingId = buildVestingId(event.address, event.params.tokenId);
  const vesting = loadOrCreateVesting(vestingId);

  const amountClaimed = partyContract.getVestingAmountClaimed(
    event.params.tokenId
  );

  party.totalAmountClaimed = party.totalAmountClaimed.plus(amountClaimed);

  vesting.amountClaimed = amountClaimed;
  vesting.periodsClaimed = partyContract.getVestingPeriodsClaimed(
    event.params.tokenId
  );

  const claimId = buildClaimId(
    event.address,
    event.params.tokenId,
    event.logIndex.toString()
  );

  // every claim will be unique
  const claim = new Claim(claimId);

  claim.vesting = vesting.id;
  claim.createdAt = event.block.timestamp;
  claim.amount = event.params.amountVested;
  claim.beneficiary = partyContract
    .getVestingBeneficiary(event.params.tokenId)
    .toHex();

  party.save();
  vesting.save();
  claim.save();
}

export function handleVestingBeneficiaryTransfered(
  event: VestingBeneficiaryTransfered
): void {
  const vestingId = buildVestingId(event.address, event.params.tokenId);
  const vesting = loadOrCreateVesting(vestingId);

  const partyContract = PartyContract.bind(event.address);

  vesting.beneficiary = partyContract
    .getVestingBeneficiary(event.params.tokenId)
    .toHex();

  vesting.save();
}

function loadOrCreateVesting(vestingId: string): Vesting {
  let vesting = Vesting.load(vestingId);
  if (vesting === null) {
    vesting = new Vesting(vestingId);
  }
  return vesting!;
}

function loadOrCreateUser(address: Address): User {
  let user = User.load(address.toHex());
  if (user === null) {
    user = new User(address.toHex());
    user.address = address;
  }
  return user!;
}

function loadOrCreateParty(address: Address): Party {
  let party = Party.load(address.toHex());
  if (party === null) {
    party = new Party(address.toHex());
    party.address = address;
  }
  return party!;
}

function loadOrCreateFactory(address: Address): PartyFactory {
  let factory = PartyFactory.load(address.toHex());
  // if no factory yet, set up empty
  if (factory === null) {
    factory = new PartyFactory(address.toHex());
    factory.address = address;
    factory.count = 0;
  }
  return factory!;
}

function buildERC20(address: Address): string {
  const id = address.toHexString();
  let token = ERC20.load(id);
  if (token === null) {
    const tokenContract = ERC20Contract.bind(address);
    token = new ERC20(id);
    token.name = tokenContract.name();
    token.symbol = tokenContract.symbol();
    token.decimals = tokenContract.decimals();
    token.save();
  }

  return token.id;
}

function buildVestingId(party: Address, tokenId: BigInt): string {
  return party.toHexString() + "-nft-" + tokenId.toString();
}

function buildClaimId(
  party: Address,
  tokenId: BigInt,
  logIndex: string
): string {
  return party.toHexString() + "-nft-" + tokenId.toString() + "-" + logIndex;
}
