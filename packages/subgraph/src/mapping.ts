import { BigInt, Address } from "@graphprotocol/graph-ts";
import { ERC20 as ERC20Contract } from "../generated/OfferFactory/ERC20";
import { CreateOfferCall } from "../generated/OfferFactory/OfferFactory";
import {
  OfferClaimed,
  VestingAdded,
  VestingRecipientTransfered,
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

export function handleCreateOffer(call: CreateOfferCall): void {
  const factory = loadOrCreateFactory(call.to);
  const offer = loadOrCreateOffer(call.outputs.offer);

  factory.count = factory.count + 1;

  offer.createdAt = call.block.timestamp;
  offer.name = call.inputs._erc721Name;
  offer.symbol = call.inputs._erc721Symbol;
  offer.token = buildERC20(call.inputs._token);
  offer.merkleRoot = call.inputs._merkleRoot;
  offer.duration = call.inputs._offerDuration;
  offer.upfrontPct = call.inputs._upfrontVestingPct;
  offer.periodUnit = castPeriodUnit(call.inputs._vestingPeriodUnit);
  offer.vestingDurationInPeriods = call.inputs._vestingDurationInPeriods;
  offer.vestingCliffInPeriods = call.inputs._vestingCliffInPeriods;

  // save to the store
  factory.save();
  offer.save();

  OfferTemplate.create(call.outputs.offer);
}

export function handleOfferClaimed(event: OfferClaimed): void {
  const vestingId = buildVestingId(event.address, event.params.tokenId);
  const vesting = loadOrCreateVesting(vestingId);

  const offerContract = OfferContract.bind(event.address);

  vesting.tokenId = event.params.tokenId;
  vesting.offer = event.address.toHex();
  vesting.startTime = event.block.timestamp;
  vesting.recipient = offerContract.getVestingRecipient(event.params.tokenId);
  vesting.amount = offerContract.getVestingAmount(event.params.tokenId);
  vesting.periodsClaimed = 0;
  vesting.amountClaimed = BigInt.fromI32(0);

  vesting.save();
}

export function handleVestingTokensClaimed(event: VestingTokensClaimed): void {
  const vestingId = buildVestingId(event.address, event.params.tokenId);
  const vesting = loadOrCreateVesting(vestingId);

  vesting.vesting.save();
}

export function handleVestingRecipientTransfered(
  event: VestingRecipientTransfered
): void {
  const vestingId = buildVestingId(event.address, event.params.tokenId);
  const vesting = loadOrCreateVesting(vestingId);

  const offerContract = OfferContract.bind(event.address);

  vesting.periodsClaimed = offerContract.getVestingPeriodsClaimed(
    event.params.tokenId
  );
  vesting.amountClaimed = offerContract.getVestingAmountClaimed(
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

function buildVestingId(vesting: Address, tokenId: BigInt): string {
  return vesting.toHexString() + "-nft-" + tokenId.toString();
}

function castPeriodUnit(state: Number): string {
  switch (state) {
    case 0:
      return "Day";
    case 1:
      return "Week";
    case 2:
      return "Month";
    default:
      return "Unknown";
  }
}
