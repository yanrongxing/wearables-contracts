// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../interfaces/chainlink/AggregatorV3Interface.sol';

contract DummyAggregatorV3Interface is AggregatorV3Interface {
    uint8 stateDecimals;
    int256 answer;

    constructor(uint8 _decimals, int256 _answer) {
        stateDecimals = _decimals;
        answer = _answer;
    }

    function decimals() external view override returns (uint8) {
        return stateDecimals;
    }

    function description() external pure override returns (string memory) {
        return 'description';
    }

    function version() external pure override returns (uint256) {
        return 0;
    }

    function getRoundData(
        uint80 // _roundId
    )
        external
        view
        override
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (0, answer, 0, 0, 0);
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (0, answer, 0, 0, 0);
    }
}
