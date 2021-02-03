import { BigInt, Address } from "@graphprotocol/graph-ts";
import { ERC20 as ERC20Contract } from "../generated/OfferFactory/ERC20";
import { NewOffer } from "../generated/OfferFactory/OfferFactory";
import {
  OfferClaimed,
  VestingAdded,
  VestingBeneficiaryTransfered,
  VestingTokensClaimed,
  Offer as OfferContract,
} from "../generated/templates/Offer/Offer";
import {
  Offer,
  OfferFactory,
  Vesting,
  Claim,
  ERC20 as ERC20,
} from "../generated/schema";
import { Offer as OfferTemplate } from "../generated/templates";

export function handleNewOffer(event: NewOffer): void {
  const factory = loadOrCreateFactory(event.address);
  const offer = loadOrCreateOffer(event.params.offer);

  const offerContract = OfferContract.bind(event.address);

  const token = offerContract.token();
  const tokenContract = ERC20Contract.bind(token);

  factory.count = factory.count + 1;

  offer.createdAt = event.block.timestamp;
  offer.factory = factory.id;
  offer.name = "Vested " + tokenContract.name();
  offer.symbol = "v" + tokenContract.symbol();
  offer.token = buildERC20(token);
  offer.merkleRoot = offerContract.merkleRoot();
  offer.endAt = offerContract.offerEnd();
  offer.upfrontPct = offerContract.upfrontVestingPct();
  offer.vestingPeriod = offerContract.vestingPeriod();
  offer.vestingDurationInPeriods = offerContract.vestingDuration();
  offer.vestingCliffInPeriods = offerContract.vestingCliff();

  factory.save();
  offer.save();

  OfferTemplate.create(event.params.offer);
}

export function handleOfferClaimed(event: OfferClaimed): void {
  const vestingId = buildVestingId(event.address, event.params.tokenId);
  const vesting = loadOrCreateVesting(vestingId);

  const offerContract = OfferContract.bind(event.address);

  vesting.tokenId = event.params.tokenId;
  vesting.offer = event.address.toHex();
  vesting.startTime = event.block.timestamp;
  vesting.beneficiary = offerContract.getVestingBeneficiary(
    event.params.tokenId
  );
  vesting.amount = offerContract.getVestingAmount(event.params.tokenId);
  vesting.periodsClaimed = 0;
  vesting.amountClaimed = BigInt.fromI32(0);

  vesting.save();
}

export function handleVestingTokensClaimed(event: VestingTokensClaimed): void {
  const vestingId = buildVestingId(event.address, event.params.tokenId);
  const vesting = loadOrCreateVesting(vestingId);

  const offerContract = OfferContract.bind(event.address);

  vesting.amountClaimed = offerContract.getVestingAmountClaimed(
    event.params.tokenId
  );
  vesting.periodsClaimed = offerContract.getVestingPeriodsClaimed(
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
  claim.beneficiary = offerContract.getVestingBeneficiary(event.params.tokenId);

  vesting.save();
  claim.save();
}

export function handleVestingBeneficiaryTransfered(
  event: VestingBeneficiaryTransfered
): void {
  const vestingId = buildVestingId(event.address, event.params.tokenId);
  const vesting = loadOrCreateVesting(vestingId);

  const offerContract = OfferContract.bind(event.address);

  vesting.beneficiary = offerContract.getVestingBeneficiary(
    event.params.tokenId
  );

  vesting.save();
}

export function handleVestingAdded(event: VestingAdded): void {}

function loadOrCreateVesting(vestingId: string): Vesting {
  let vesting = Vesting.load(vestingId);
  if (vesting === null) {
    vesting = new Vesting(vestingId);
  }
  return vesting!;
}

function loadOrCreateOffer(address: Address): Offer {
  let offer = Offer.load(address.toHex());
  if (offer === null) {
    offer = new Offer(address.toHex());
    offer.address = address;
  }
  return offer!;
}

function loadOrCreateFactory(address: Address): OfferFactory {
  let factory = OfferFactory.load("1");
  // if no factory yet, set up empty
  if (factory === null) {
    factory = new OfferFactory("1");
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

function buildVestingId(offer: Address, tokenId: BigInt): string {
  return offer.toHexString() + "-nft-" + tokenId.toString();
}

function buildClaimId(
  offer: Address,
  tokenId: BigInt,
  logIndex: string
): string {
  return offer.toHexString() + "-nft-" + tokenId.toString() + "-" + logIndex;
}
