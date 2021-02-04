// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

import "./Party.sol";

contract PartyFactory {
    event NewParty(address party);

    function startParty(
        address _token,
        bytes32 _merkleRoot,
        uint64 _upfrontVestingPct,
        uint8 _vestingPeriodUnit,
        uint16 _vestingDurationInPeriods,
        uint16 _vestingCliffInPeriods
    ) public returns (Party party) {
        party = new Party(
            _token,
            _merkleRoot,
            _upfrontVestingPct,
            _vestingPeriodUnit,
            _vestingDurationInPeriods,
            _vestingCliffInPeriods
        );

        emit NewParty(address(party));
    }
}
