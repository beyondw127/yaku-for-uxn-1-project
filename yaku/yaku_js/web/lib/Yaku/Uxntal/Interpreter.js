"use strict";

// Version of this module
export const VERSION = "1.0.0";

// Constants from environment variables (Node.js specific)
const VV = (typeof process !== 'undefined' && process.env?.YAKU_VERBOSE)
  ? parseInt(process.env.YAKU_VERBOSE, 10)
  : (typeof process === 'undefined'  )  ? function(){   
        let params = new URL(document.location.toString()).searchParams; 
        let VVval = parseInt(params.get("VV"),10); 
        return VVval;
    }() : 0;

// Imports from other Yaku modules
import { WRS, EE, WW, NSW } from '../Flags.js';
import {
    stack_operations, // Object/Map
    bin_ops,          // Object/Map
    opcodes, // List
    LIT, INSTR, RAW, REF   // Constants
} from './Definitions.js';
import { loadToken } from './Encoder.js';
import {
    unsignedBytesToUnsignedShort,
    unsignedShortToUnsignedBytes
} from '../IntegerFormatConversions.js';
import { prettyPrintToken, toHex } from './PrettyPrint.js';
import { getLineForToken } from './ErrorChecking.js';

// Assuming Yaku::Uxntal::Actions exports an object `callInstr`
import { callInstr } from './Actions.js';

// Global warning tracker (Perl's %warnings = () is a package variable)
var uniqueWarnings = {}; // Used to warn only once for specific size mismatches.
var warningStrs = [];
var skip_warning = 0;

/**
 * Runs the Uxn program stored in the Uxn virtual machine's memory.
 * @param {object} yakuState - The Uxn virtual machine state object.
 * @returns {void} The program execution terminates (or throws an error).
 * @throws {Error} If no main program is found, program counter exceeds memory,
 * or an unhandled error occurs during instruction execution.
 */
export function runProgram(yakuState) {
    uniqueWarnings = {};
    warningStrs = [];
    if (!yakuState.hasOwnProperty('hasMain') || yakuState.hasMain === 0) {
        throw new Error("There is no main program (|0100) in this source file, nothing to run.\n");
    }
    
    if (VV === 2) {
        console.log('*** RUNNING ***');        
    }
    
    yakuState.Uxn.pc = 0x100; // All programs must start at 0x100
    const word_sz = 1; // Default word size
    let current_parent = 'MAIN';
    const call_stack = ['MAIN'];
    
    while (true) {
        if (yakuState.Uxn.pc > 0xffff) {
            throw new Error("Program counter reached end of memory.\n");
        }
        // console.warn(yakuState.Uxn.memory[yakuState.Uxn.pc],yakuState.Uxn.pc);
        if(yakuState.Uxn.memory[yakuState.Uxn.pc].at(-1) === 'no_warning') {
            // console.warn(yakuState.Uxn.memory[yakuState.Uxn.pc]);
            ++skip_warning;
        }
        if(yakuState.Uxn.memory[yakuState.Uxn.pc].at(-1) === 'use_warning') {
            // console.warn('use_warning');
            // console.warn(yakuState.Uxn.memory[yakuState.Uxn.pc]);
            --skip_warning;
        }
        let token = loadToken(word_sz, yakuState, yakuState.Uxn.pc);

        // Handle different token types
        if (token[0] === LIT) {
            throw new Error(`Should no longer happen! Token: ${JSON.stringify(token)}`);
        } else if (token[0] === INSTR || token[0] === RAW ) {
            if (token[0] === RAW) {
                if (token[2]==1) {
                    token = rawToInstr(token);
                } else {
                    throw new Error('TODO: split 2-byte RAW tokens into 1-byte pairs ');
                }
            }
            // Handle call stack tracking for jumps and calls
            if (token[1] === 'JSR' && token[2] === 2 && token[3] === 0) { // JSR2
                if (yakuState.reverseSymbolTable.hasOwnProperty(yakuState.Uxn.pc - 3)) {
                    current_parent = prettyPrintToken(yakuState.reverseSymbolTable[yakuState.Uxn.pc - 3][0]);
                    call_stack.push(current_parent);
                } else {
                    current_parent = '<lambda>';
                    call_stack.push(current_parent);
                }
            } else if (token[1] === 'JSI') { // JSI
                if (yakuState.reverseSymbolTable.hasOwnProperty(yakuState.Uxn.pc + 1)) {
                    current_parent = prettyPrintToken(yakuState.reverseSymbolTable[yakuState.Uxn.pc + 1][0]);
                    call_stack.push(current_parent);
                }
            } else if (token[1] === 'JMP' && token[2] === 2 && token[3] === 0) { // JMP2
                if (yakuState.reverseSymbolTable.hasOwnProperty(yakuState.Uxn.pc - 3)) {
                    current_parent = prettyPrintToken(yakuState.reverseSymbolTable[yakuState.Uxn.pc - 3][0]);
                }
            } else if (token[1] === 'JMI') { // JMI
                if (yakuState.reverseSymbolTable.hasOwnProperty(yakuState.Uxn.pc + 1)) {
                    current_parent = prettyPrintToken(yakuState.reverseSymbolTable[yakuState.Uxn.pc + 1][0]);
                }
            }

            // Handle returns
            if (token[1] === 'JMP' && token[2] === 2 && token[3] === 1) { // JMP2r
                call_stack.pop();
                if (call_stack.length>0){
                    current_parent = call_stack[call_stack.length - 1];
                } else {
                    current_parent = 'MAIN';
                }
            } else if (token[1] === 'JMP' && token[2] === 2 && token[3] === 0) { // JMP2 (tail call check)
                const prev_token = loadToken(word_sz, yakuState, yakuState.Uxn.pc - 1);
                if (prev_token && prev_token[1] === 'STH' && prev_token[2] === 2 && prev_token[3] === 1) {
                    call_stack.pop();
                    if (call_stack.length>0){
                        current_parent = call_stack[call_stack.length - 1];
                    } else {
                        current_parent = 'MAIN';
                    }
                }
            }

            var [execStatus,yakuState_] = executeInstr(token, yakuState, current_parent);
            if (execStatus==0) {
                break;
            }
            // if (yakuState.forWeb==1) {
            //     yakuState.webState.warningsBuffer += yakuState_.webState.warningsBuffer;
            //     yakuState.webState.errorsBuffer += yakuState_.webState.errorsBuffer;
            // }
        }

        yakuState.Uxn.pc++;
    }
    return [yakuState,warningStrs];
} 

/**
 * Executes a single Uxn instruction.
 */
function executeInstr(token, yakuState, current_parent) {
    const [, instr, sz, rs, keep] = token;
    // 修复BRK指令处理 - 正常退出而不是抛出异常
    if (instr === 'BRK') {        
        if (VV === 1) {            
            console.log('\n*** DONE *** ');
        } else {
            // process.stdout.write('');
        }
        if (VV === 2) {
            console.log(`BRK PC:${yakuState.Uxn.pc} (WS,RS) ${JSON.stringify(yakuState.Uxn.stacks)}`);
        }
        if (WRS) {
            showStacks(yakuState);
        }
        // process.exit(0);  // 正常退出       
        return([0,yakuState]) ;
    }

    const instructionDetails = callInstr[instr];
    if (!instructionDetails) {
        throw new Error(`Unknown instruction: ${prettyPrintToken(token)} at PC ${yakuState.Uxn.pc} in ${current_parent} ${getLineForToken(token, yakuState)}`);
    }

    const [action, nArgs, hasRes] = instructionDetails;

    if (nArgs === 0) { // Stack manipulation instructions
        if (VV === 2) {
            console.log(`EXEC STACK MANIP INSTR: ${prettyPrintToken(token)} @PC ${yakuState.Uxn.pc}`);
            console.log(` (WS,RS) ${JSON.stringify(yakuState.Uxn.stacks)}`);
        }
        yakuState = conditionStack(token, yakuState, current_parent);
        action(rs, sz, yakuState, keep);
    } else { // Instructions that take arguments from stack
        const args = getArgsFromStack(token, instr, nArgs, sz, rs, keep, yakuState, current_parent);

        if (VV === 2) {
            console.log(`EXEC INSTR: ${prettyPrintToken(token)} with args ${JSON.stringify(args)}`);
            console.log(`STACKS: (WS,RS) ${JSON.stringify(yakuState.Uxn.stacks)}`);
        }
        if (hasRes) {
            const res = action(args, sz, yakuState);

            // Special handling for comparison results
            if (instr === 'EQU' || instr === 'NEQ' || instr === 'LTH' || instr === 'GTH') {
                yakuState.Uxn.stacks[rs].push([res, 1]);
            } else {
                yakuState.Uxn.stacks[rs].push([res, sz]);
            }
        } else {
            action(args, sz, yakuState);
        }
    }

    // Handle warnings generated during execution
    if (yakuState.hasOwnProperty('warning')) {
        console.warn(`${yakuState.warning}: ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`);
        delete yakuState.warning;
        if (EE) {
            throw new Error(`Execution error due to warning becoming an error: ${prettyPrintToken(token)}`);
        }
    }

    if (VV === 2) {
        console.log(`AFTER INSTR ${instr}${sz === 2 ? '2' : ''}: PC:${yakuState.Uxn.pc}=>${JSON.stringify(yakuState.Uxn.memory[yakuState.Uxn.pc])}; (WS,RS) ${JSON.stringify(yakuState.Uxn.stacks)}`);
    }
    return([1,yakuState]) ;
}

/**
 * Retrieves arguments for an instruction from the current stack.
 */
function getArgsFromStack(token, instr, nArgs, sz, rs, keep, yakuState, current_parent) {
    const args = [];
    const keep_args = [];

    if (VV === 2) {
        console.log(`NARGS for INSTR: ${prettyPrintToken(token)}: ${nArgs}`);
    }

    for (let i = 0; i < nArgs; i++) {
        if (yakuState.Uxn.stacks[rs].length === 0) {
            console.error(`Error: Stack underflow for ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`);
            throw new Error(`\nStack underflow for ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`);
        }

        let arg_val, arg_sz;

        // Special handling for argument sizes based on instruction - 修复参数获取逻辑
        if (instr === 'LDA' || instr === 'STA') {
            // 第一个参数总是2字节地址，第二个参数根据sz决定
            [arg_val, arg_sz] = (i === 0)
                ? _getShortArg(token, yakuState, current_parent)
                : (sz === 2)
                    ? _getShortArg(token, yakuState, current_parent)
                    : _getByteArg(token, yakuState, current_parent);
        } else if (instr.startsWith('LD') || instr.startsWith('ST') || instr === 'DEI') {
            // 第一个参数总是1字节地址，第二个参数根据sz决定
            [arg_val, arg_sz] = (i === 0)
                ? _getByteArg(token, yakuState, current_parent)
                : (sz === 2)
                    ? _getShortArg(token, yakuState, current_parent)
                    : _getByteArg(token, yakuState, current_parent);
        } else if (instr === 'JCN') {
            // 第二个参数(条件)总是1字节
            [arg_val, arg_sz] = (i === 1)
                ? _getByteArg(token, yakuState, current_parent)
                : (sz === 2)
                    ? _getShortArg(token, yakuState, current_parent)
                    : _getByteArg(token, yakuState, current_parent);
        } else if (instr === 'JCI') {
            // 参数总是1字节
            [arg_val, arg_sz] = _getByteArg(token, yakuState, current_parent);
        } else if (instr === 'SFT' || instr === 'DEO') {
            // 第一个参数总是1字节，第二个参数根据sz决定
            [arg_val, arg_sz] = (i === 0)
                ? _getByteArg(token, yakuState, current_parent)
                : (sz === 2)
                    ? _getShortArg(token, yakuState, current_parent)
                    : _getByteArg(token, yakuState, current_parent);
        } else {
            // 两个参数都是相同大小
            [arg_val, arg_sz] = (sz === 2)
                ? _getShortArg(token, yakuState, current_parent)
                : _getByteArg(token, yakuState, current_parent);
        }

        args.push(arg_val);
        if (keep) {
            keep_args.push([arg_val, arg_sz]);
        }
    }

    if (keep) {
        for (let i = keep_args.length - 1; i >= 0; i--) {
            yakuState.Uxn.stacks[rs].push(keep_args[i]);
        }
    }

    return args;
}

/**
 * Helper function to extend a byte argument with an extra byte from the stack.
 */
function _extendWithExtraByte(arg1_token, token, yakuState, current_parent) {
    const [, , , rs] = token;
    const arg1_val = arg1_token[0];

    if (yakuState.Uxn.stacks[rs].length === 0) {
        console.error(`Error: Stack underflow for ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`);
        throw new Error(`Error: Stack underflow for ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`);
    }
    const arg2_token = yakuState.Uxn.stacks[rs].pop();

    let arg_val;
    let split_short = 0;

    if (arg2_token[1] === 1) {
        arg_val = unsignedBytesToUnsignedShort(arg2_token[0], arg1_val);
    } else {
        split_short = 1;
        const [hi_byte2, lo_byte2] = unsignedShortToUnsignedBytes(arg2_token[0]);
        yakuState.Uxn.stacks[rs].push([hi_byte2, 1]);
        arg_val = unsignedBytesToUnsignedShort(lo_byte2, arg1_val);
    }
    return [arg_val, split_short];
}

/**
 * Pops a byte argument from the current stack.
 */
function _getByteArg(token, yakuState, current_parent) {
    const [, instr, , rs] = token;
    const arg_token = yakuState.Uxn.stacks[rs].pop();

    let arg_val;
    if (arg_token[1] === 2) {
        if (!WW || (WW && instr !== 'DEO' && !bin_ops.hasOwnProperty(instr))) {
            warnSizeMismatch(token, yakuState, current_parent, 1);
        }
        const [arg_hi, arg_lo] = unsignedShortToUnsignedBytes(arg_token[0]);
        yakuState.Uxn.stacks[rs].push([arg_hi, 1]);
        arg_val = arg_lo;
    } else {
        arg_val = arg_token[0];
    }
    return [arg_val, 1];
}

/**
 * Pops a short argument from the current stack.
 */
function _getShortArg(token, yakuState, current_parent) {
    const [, , , rs] = token;
    const arg_token = yakuState.Uxn.stacks[rs].pop();

    let arg_val;
    if (arg_token[1] === 1) { // arg is a byte 
        const [extended_val, split_short] = _extendWithExtraByte(arg_token, token, yakuState, current_parent);
        if (split_short) {
            warnSizeMismatch(token, yakuState, current_parent, 0);
        }
        arg_val = extended_val;
    } else {
        arg_val = arg_token[0];
    }
    return [arg_val, 2];
}

/**
 * Pre-conditions the stack for stack manipulation instructions.
 */
function conditionStack(token, yakuState, current_parent) {
    const [, instr, sz, rs] = token;

    if (!stack_operations.hasOwnProperty(instr)) {
        return yakuState;
    }

    const [nBytesNeeded_raw, hasResult_raw] = stack_operations[instr];
    const nBytesNeeded = nBytesNeeded_raw * sz;
    let nBytesGot = 0;
    const eltsForInstr = [];

    while (nBytesGot < nBytesNeeded) {
        if (yakuState.Uxn.stacks[rs].length === 0) {
            console.error(`Error: Stack underflow, got ${nBytesGot}, need ${nBytesNeeded} for ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`);
            throw new Error(`Error: Stack underflow, got ${nBytesGot}, need ${nBytesNeeded} for ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`);
        }
        let elt = yakuState.Uxn.stacks[rs].pop();

        nBytesGot += elt[1];

        if (nBytesGot > nBytesNeeded) {
            const [hi_byte, lo_byte] = unsignedShortToUnsignedBytes(elt[0]);
            yakuState.Uxn.stacks[rs].push([hi_byte, 1]);
            nBytesGot -= 1;
            elt = [lo_byte, 1];
        }

        if (sz === 2 && elt[1] === 1) {
            warnSizeMismatch(token, yakuState, current_parent, 0);
            const lo_byte = elt[0];
            let hi_byte = 0;

            if (yakuState.Uxn.stacks[rs].length === 0) {
                console.error(`Error: Stack underflow, got ${nBytesGot}, need ${nBytesNeeded} for ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`);
                throw new Error(`Error: Stack underflow, got ${nBytesGot}, need ${nBytesNeeded} for ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`);
            }
            const elt2 = yakuState.Uxn.stacks[rs].pop();
            nBytesGot += elt2[1];

            if (elt2[1] === 1) {
                hi_byte = elt2[0];
            } else {
                const [hi_byte2, lo_byte2] = unsignedShortToUnsignedBytes(elt2[0]);
                yakuState.Uxn.stacks[rs].push([hi_byte2, 1]);
                nBytesGot -= 1;
                hi_byte = lo_byte2;
            }
            const elt_val = unsignedBytesToUnsignedShort(hi_byte, lo_byte);
            eltsForInstr.unshift([elt_val, 2]);
        } else if (sz === 1 && elt[1] === 2) {
            warnSizeMismatch(token, yakuState, current_parent, 1);
            const [hi_byte, lo_byte] = unsignedShortToUnsignedBytes(elt[0]);
            eltsForInstr.unshift([lo_byte, 1]);
            yakuState.Uxn.stacks[rs].push([hi_byte, 1]);
            nBytesGot -= 1;
        } else {
            eltsForInstr.unshift(elt);
        }
    }
    
    yakuState.Uxn.stacks[rs] = [...yakuState.Uxn.stacks[rs], ...eltsForInstr];
    return yakuState;
}


function rawToInstr(token) {
    let instrVal = token[1];
    let instrToken = [INSTR,'',0,0,0];
    
    switch (instrVal) {
        // check the special cases first
        case 0x00 : instrToken = [INSTR,'BRK',1,0,0] ; break; 
        case 0x20 : instrToken = [INSTR,'JCI',1,0,0] ; break; 
        case 0x40 : instrToken = [INSTR,'JMI',1,0,0] ; break; 
        case 0x60 : instrToken = [INSTR,'JSI',1,0,0] ; break; 
        case 0x80 : instrToken = [INSTR,'LIT',1,0,0] ; break; 
        case 0xa0 : instrToken = [INSTR,'LIT',2,0,0] ; break; 
        case 0xc0 : instrToken = [INSTR,'LIT',1,1,0] ; break; 
        case 0xe0 : instrToken = [INSTR,'LIT',2,1,0] ; break; 
        // decode the token
        default :
            let w = (instrVal>>5)+1;
            let r = (instrVal>>6) & 0x01;
            let k = (instrVal>>7) & 0x01;
            let instr = instrVal & 0x1f;
            let instrMnemonic = opcodes[instr];
            instrToken = [INSTR,instrMnemonic,w,r,k]
            break;
    }
    return instrToken;    
    
}

/**
 * Issues a size mismatch warning if not suppressed by flags.
 */
function warnSizeMismatch(token, yakuState, current_parent, sb) {
    // console.warn('warnSizeMismatch:',skip_warning);
    if (skip_warning>0) {
        return;
    }
    let warning_line_key = prettyPrintToken(token);
    warning_line_key += `_${current_parent}${getLineForToken(token, yakuState)}`;
    warning_line_key = warning_line_key.replace(/:\s*.+$/, '');
    warning_line_key = warning_line_key.replace(/\son\sline\s/g, '_');
    warning_line_key = warning_line_key.replace(/\sof\s/g, '_');
    warning_line_key = warning_line_key.replace(/\.tal$/, '');

    if (!uniqueWarnings.hasOwnProperty(warning_line_key)) {
        uniqueWarnings[warning_line_key] = 1;

        if (!(WW || NSW)) {
            const message = sb === 1
                ? 'short, instruction expects byte'
                : 'byte, instruction expects short';
            console.warn(`Warning: value on stack is ${message}: ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`); // WV: to add colour: '\x1b[35m%s\x1b[0m',
            // yakuState.webState.warningsBuffer+=
            let warning_str = `Value on stack is ${message}: ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`+"\n";
            warningStrs.push(warning_str);
            if (EE) {
                throw new Error(`Warning: value on stack is ${message}: ${prettyPrintToken(token)} in ${current_parent}${getLineForToken(token, yakuState)}`);
            }
        }
    }
}

/**
 * Prints the current state of the working and return stacks.
 */
function showStacks(yakuState) {
    console.log('Working Stack: [\n');
    for (const t of yakuState.Uxn.stacks[0]) {
        console.log(`${toHex(t[0], t[1])} `);
    }
    console.log(']\n');
    console.log('Return Stack: [\n');
    for (const t of yakuState.Uxn.stacks[1]) {
        console.log(`${toHex(t[0], t[1])} `);
    }
    console.log(']');

    // for (const t of yakuState.Uxn.stacks[0]) {
    //     console.log(`\t${toHex(t[0], t[1])}\t(${t[1] === 1 ? 'byte' : 'short'} ${t[0]})`);
    // }
    // console.log('\t]');
    // console.log('Return Stack: [');
    // for (const t of yakuState.Uxn.stacks[1]) {
    //     console.log(`\t${toHex(t[0], t[1])}\t(${t[1] === 1 ? 'byte' : 'short'} ${t[0]})`);
    // }
    // console.log('\t]');
}