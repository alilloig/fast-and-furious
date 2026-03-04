#[test_only]
module fast_and_furious::test_utils;

use sui::test_scenario::{Self as ts, Scenario};

const ADMIN: address = @0xAD;
const USER1: address = @0x01;
const USER2: address = @0x02;

public fun admin(): address { ADMIN }
public fun user1(): address { USER1 }
public fun user2(): address { USER2 }

public fun begin(): Scenario { ts::begin(ADMIN) }
