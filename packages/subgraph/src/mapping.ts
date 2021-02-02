import { BigInt, Address } from "@graphprotocol/graph-ts";
import { ERC20 as ERC20Contract } from "../generated/OfferFactory/ERC20";
import { CreateOfferCall } from "../generated/OfferFactory/OfferFactory";
import {
  OfferClaimed,
  VestingAdded,
  VestingRecipientTransfered,
  VestingTokensClaimed,
} from "../generated/templates/Offer/Offer";
import {
  Offer as OfferEntity,
  OfferFactory as OfferFactoryEntity,
  Vesting,
  Claim,
  ERC20 as ERC20Entity,
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

function loadOrCreateFactory(address: Address): OfferFactoryEntity {
  let factory = OfferFactoryEntity.load("1");
  // if no factory yet, set up empty
  if (factory === null) {
    factory = new OfferFactoryEntity("1");
    factory.address = address;
    factory.count = 0;
  }
  return factory!;
}

export function loadOrCreateOffer(address: Address): OfferEntity {
  let offer = OfferEntity.load(address.toHex());
  if (offer === null) {
    offer = new OfferEntity(address.toHex());
    offer.address = address;
  }
  return offer!;
}

export function buildERC20(address: Address): string {
  const id = address.toHexString();
  let token = ERC20Entity.load(id);

  if (token === null) {
    const tokenContract = ERC20Contract.bind(address);
    token = new ERC20Entity(id);
    token.name = tokenContract.name();
    token.symbol = tokenContract.symbol();
    token.decimals = tokenContract.decimals();
    token.save();
  }

  return token.id;
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
