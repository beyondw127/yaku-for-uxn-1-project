"use strict";

const VERSION = "1.0.0";

import { EMPTY } from './Definitions.js';

export const initialUxn = {
    memory: Array(0x10000).fill().map(() => [EMPTY, 0, 1]),  // [EMPTY,0,1] x 0x10000
    stacks: [[], []],           // ws, rs (working stack, return stack)
    stackPtr: [0, 0],           // highest is 255, no circular stacks
    pc: 0,                      // Program counter
    free: 0,                    // First unused address
    dev: [],
};
