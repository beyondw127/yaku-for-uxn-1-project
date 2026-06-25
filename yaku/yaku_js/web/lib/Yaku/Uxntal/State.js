"use strict";

const VERSION = "1.0.0";

import { initialUxn } from './Uxn.js';

export const initialWebState = {
    outputBuffer: "",
    warningsBuffer: "",
    errorsBuffer: "",
    romFile: null,
    romContent: null 
};

export function initYakuState(hasMain, supportPaging,forWeb) {
    return {
        Uxn : initialUxn,
        // Symbol table
        symbolTable : {},
        // For error checking
        reverseSymbolTable : {},
        // First unused address,
        // free  :  0,
        lambdaStack : [],
        lambdaCount : 0,
        hasMain : hasMain,
        // dev : [],
        supportPaging : supportPaging,
        forWeb: forWeb,
        webState: initialWebState
    };
}
