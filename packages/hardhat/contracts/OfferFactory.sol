// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

import "./Offer.sol";

contract OfferFactory {
    event NewOffer(address offer);

    function createOffer(
        address _token,
        bytes32 _merkleRoot,
        uint256 _offerDuration,
        uint64 _upfrontVestingPct,
        uint8 _vestingPeriodUnit,
        uint16 _vestingDurationInPeriods,
        uint16 _vestingCliffInPeriods
    ) public returns (Offer offer) {
        offer = new Offer(
            _token,
            _merkleRoot,
            _offerDuration,
            _upfrontVestingPct,
            _vestingPeriodUnit,
            _vestingDurationInPeriods,
            _vestingCliffInPeriods
        );

        emit NewOffer(address(offer));

        return offer;
    }
}
