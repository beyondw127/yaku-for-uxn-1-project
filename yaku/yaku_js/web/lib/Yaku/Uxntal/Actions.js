"use strict";

// 对应 $VERSION = "1.0.0"
const VERSION = "1.0.0";

// 对应 use constant DBG => $ENV{YAKU_DBG} // 0;
const DBG = (typeof process !== 'undefined' && process.env?.YAKU_VERBOSE)
  ? parseInt(process.env.YAKU_VERBOSE)
  : 0;

// 导入模块
import { RAW, EMPTY, INSTR, opcode } from './Definitions.js';
import { loadToken, storeToken } from './Encoder.js';
import { 
    byte2sCompToSignedByte,
    short2sComptToBytes2sComp,
    short2sCompToSignedShort,
    unsignedBytesToUnsignedShort,
    signedShortToShort2sComp,
    signedByteToByte2sComp
} from '../IntegerFormatConversions.js';


export function store(args, sz, yakuState) {
    storeToken([RAW, args[1], sz], yakuState, args[0]);
}

// 对应 sub load($args,$sz,$yakuState)
export function load(args, sz, yakuState) {
    const token = loadToken(sz, yakuState, args[0]);
    return token[1];
}

// 对应 sub storeRel($args,$sz,$yakuState)
export function storeRel(args, sz, yakuState) {
    const pc = yakuState.Uxn.pc + byte2sCompToSignedByte(args[0]) + 1;
    const token = [RAW, args[1], sz];
    const addr = storeToken(token, yakuState, pc);
}

// 对应 sub loadRel($args,$sz,$yakuState)
export function loadRel(args, sz, yakuState) {
    const pc = yakuState.Uxn.pc + byte2sCompToSignedByte(args[0]) + 1;
    const token = loadToken(sz, yakuState, pc);
    return token[1];
}

// 对应 sub call($args,$sz,$yakuState)
export function call(args, sz, yakuState) {
    const [hib, lob] = short2sComptToBytes2sComp(yakuState.Uxn.pc + 1);
    yakuState.Uxn.stacks[1].push([yakuState.Uxn.pc + 1, 2]);
    if (sz === 1) {
        yakuState.Uxn.pc += byte2sCompToSignedByte(args[0]);
    } else {
        yakuState.Uxn.pc = args[0] - 1;
    }
}

// 对应 sub jump($args,$sz,$yakuState)
export function jump(args, sz, yakuState) {
    if (sz === 1) { // relative jump
        yakuState.Uxn.pc += byte2sCompToSignedByte(args[0]);
    } else {
        yakuState.Uxn.pc = args[0] - 1;
    }
}

// 对应 sub condJump($args,$sz,$yakuState)
export function condJump(args, sz, yakuState) {
    if (args[1] !== 0) {
        if (sz === 1) { // relative jump
            const pc = yakuState.Uxn.pc + byte2sCompToSignedByte(args[0]);
            yakuState.Uxn.pc = pc;
        } else {
            yakuState.Uxn.pc = args[0] - 1;
        }
    }
}

// 对应 sub immediateCall($rs,$sz,$yakuState,$keep)
export function immediateCall(rs, sz, yakuState, keep) { // keep is ignored
    // Pushes PC+3 to the return-stack
    yakuState.Uxn.stacks[1].push([yakuState.Uxn.pc + 3, 2]);

    // Move the PC to a relative address at a distance equal to the next short in memory.
    const rel_addr_token = loadToken(2, yakuState, yakuState.Uxn.pc + 1);
    const rel_addr = rel_addr_token[1];
    const pc = yakuState.Uxn.pc + 2 + short2sCompToSignedShort(rel_addr);
    yakuState.Uxn.pc = pc;
}

// 对应 sub immediateCondJump($args,$sz,$yakuState)
export function immediateCondJump(args, sz, yakuState) { // keep is ignored
    if (args[0] !== 0) {
        const rel_addr_token = loadToken(2, yakuState, yakuState.Uxn.pc + 1);
        const rel_addr = rel_addr_token[1];
        const pc = yakuState.Uxn.pc + 2 + short2sCompToSignedShort(rel_addr);
        yakuState.Uxn.pc = pc;
    } else {
        yakuState.Uxn.pc += 2;
    }
}

// 对应 sub immediateJump($rs,$sz,$yakuState,$keep)
export function immediateJump(rs, sz, yakuState, keep) { // keep is ignored
    const rel_addr_token = loadToken(2, yakuState, yakuState.Uxn.pc + 1);
    const rel_addr = rel_addr_token[1];
    const pc = yakuState.Uxn.pc + 2 + short2sCompToSignedShort(rel_addr);
    yakuState.Uxn.pc = pc;
}

// 对应 sub lit($rs,$sz,$yakuState,$keep)
export function lit(rs, sz, yakuState, keep) { // keep is ignored
    const token = yakuState.Uxn.memory[yakuState.Uxn.pc + 1];
    if (sz === 1) {
        if (token[0]!==INSTR) {
            yakuState.Uxn.stacks[rs].push([token[1], token[2]]);
        } else {
            // It's an instruction, get its byte value
            const [, instr, short, r, k] = token;
            const instr_byte = ((short-1) << 5) + (r << 6) + (k << 7) + (opcode[instr] & 0x1F);
            yakuState.Uxn.stacks[rs].push([instr_byte,1]);
        }
        yakuState.Uxn.pc++;
    } else if (sz === 2) {
        const next_token = yakuState.Uxn.memory[yakuState.Uxn.pc + 2];
        const short_val = unsignedBytesToUnsignedShort(token[1], next_token[1]);
        yakuState.Uxn.stacks[rs].push([short_val, 2]);
        yakuState.Uxn.pc += 2;
    }
}

// 对应 sub stash($rs,$sz,$yakuState,$keep)
export function stash(rs, sz, yakuState, keep) {
    if (keep) {
        const a = yakuState.Uxn.stacks[rs][yakuState.Uxn.stacks[rs].length - 1];
        yakuState.Uxn.stacks[1 - rs].push(a);
    } else {
        const a = yakuState.Uxn.stacks[rs].pop();
        yakuState.Uxn.stacks[1 - rs].push(a);
    }
}

// 对应 sub pop_($rs,$sz,$yakuState,$keep)
export function pop_(rs, sz, yakuState, keep) {
    if (!keep) { // makes no sense but nevertheless
        yakuState.Uxn.stacks[rs].pop();
    }
}

// 对应 sub swap($rs,$sz,$yakuState,$keep)
export function swap(rs, sz, yakuState, keep) { // a1 a2 b1 b2 => b1 b2 a1 a2
    const b = yakuState.Uxn.stacks[rs].pop();
    const a = yakuState.Uxn.stacks[rs].pop();
    if (keep) {
        yakuState.Uxn.stacks[rs].push(a);
        yakuState.Uxn.stacks[rs].push(b);
    }
    yakuState.Uxn.stacks[rs].push(b);
    yakuState.Uxn.stacks[rs].push(a);
}

// 对应 sub nip($rs,$sz,$yakuState,$keep) - 修复递归调用问题
export function nip(rs, sz, yakuState, keep) { // a b -> b; a1 a2 b1 b2 -> b1 b2
    sz = 1; // for debugging
    if (keep) {
        dup(rs, sz, yakuState, 0); // 修复：添加分号
    } else {
        const b = yakuState.Uxn.stacks[rs].pop();
        if (sz === 1) {
            const a = yakuState.Uxn.stacks[rs].pop();
            yakuState.Uxn.stacks[rs].push(b);
        } else {
            const b2 = [...b];
            const b1 = yakuState.Uxn.stacks[rs].pop();
            const a2 = yakuState.Uxn.stacks[rs].pop();
            const a1 = yakuState.Uxn.stacks[rs].pop();
            yakuState.Uxn.stacks[rs].push(b1);
            yakuState.Uxn.stacks[rs].push(b2);
        }
    }
}

// 对应 sub rot($rs,$sz,$yakuState,$keep)
export function rot(rs, sz, yakuState, keep) { // a b c -> b c a
    const c = yakuState.Uxn.stacks[rs].pop();
    const b = yakuState.Uxn.stacks[rs].pop();
    const a = yakuState.Uxn.stacks[rs].pop();
    if (keep) {
        yakuState.Uxn.stacks[rs].push(a);
        yakuState.Uxn.stacks[rs].push(b);
        yakuState.Uxn.stacks[rs].push(c);
    }
    yakuState.Uxn.stacks[rs].push(b);
    yakuState.Uxn.stacks[rs].push(c);
    yakuState.Uxn.stacks[rs].push(a);
}

// 对应 sub dup($rs,$sz,$yakuState,$keep)
export function dup(rs, sz, yakuState, keep) {
    const a = yakuState.Uxn.stacks[rs][yakuState.Uxn.stacks[rs].length - 1];
    yakuState.Uxn.stacks[rs].push([...a]);
    if (keep) {
        yakuState.Uxn.stacks[rs].push([...a]);
    }
}

// 对应 sub over($rs,$sz,$yakuState,$keep)
export function over(rs, sz, yakuState, keep) { // a b -> a b a; keep: a b a b a
    const a = yakuState.Uxn.stacks[rs][yakuState.Uxn.stacks[rs].length - 2];
    yakuState.Uxn.stacks[rs].push([...a]);
    if (keep) {
        dup(rs, 2, yakuState, 0);
    }
}

// 对应 sub add($args,$sz,$yakuState)
export function add(args, sz, yakuState) { // 2's comp
    const res = (args[1] + args[0]);
    return (sz === 1 ? res & 0xff : res & 0xffff);
}

// 对应 sub sub_($args,$sz,$yakuState)
export function sub_(args, sz, yakuState) {
    if (sz === 2) {
        return (signedShortToShort2sComp(args[1] - args[0])) & 0xffff;
    } else {
        return (signedByteToByte2sComp(args[1] - args[0])) & 0xff;
    }
}

// 对应 sub mul($args,$sz,$yakuState)
export function mul(args, sz, yakuState) {
    const res = args[1] * args[0];
    return (sz === 1 ? res & 0xff : res & 0xffff);
}

// 对应 sub div($args,$sz,$yakuState)
export function div(args, sz, yakuState) {
    return Math.floor(args[1] / args[0]);
}

// 对应 sub inc($args,$sz,$yakuState)
export function inc(args, sz, yakuState) {
    const res = args[0] + 1;
    return (sz === 1 ? res & 0xff : res & 0xffff);
}

// 对应 sub sft($args,$sz,$yakuState)
export function sft(args, sz, yakuState) {
    const shift_word = args[0];
    let res = args[1];
    if ((shift_word & 0xf) >0 ) { //  do a right shift
        res =  (( res  >> (shift_word & 0xf)) & (sz==1? 0xff : 0xffff));
    } else {
        res  = ((res  << (shift_word>>4)) & (sz==1? 0xff : 0xffff));
    }
    return res;
}

// 对应 sub and_($args,$sz,$yakuState)
export function and_(args, sz, yakuState) {
    return (args[1] & args[0]);
}

// 对应 sub ora($args,$sz,$yakuState)
export function ora(args, sz, yakuState) {
    return (args[1] | args[0]);
}

// 对应 sub eor($args,$sz,$yakuState)
export function eor(args, sz, yakuState) {
    return (args[1] ^ args[0]);
}

// 对应 sub equ($args,$sz,$yakuState)
export function equ(args, sz, yakuState) {
    return args[0] === args[1] ? 1 : 0;
}

// 对应 sub neq($args,$sz,$yakuState)
export function neq(args, sz, yakuState) {
    return args[0] !== args[1] ? 1 : 0;
}

// 对应 sub lth($args,$sz,$yakuState)
export function lth(args, sz, yakuState) {
    return args[1] < args[0] ? 1 : 0;
}

// 对应 sub gth($args,$sz,$yakuState)
export function gth(args, sz, yakuState) {
    return args[1] > args[0] ? 1 : 0;
}

// 对应 sub deviceOut($args,$sz,$yakuState)
export function deviceOut(args, sz, yakuState) {
    // Sending a non-null byte to the System/state port will terminate the application
    if (args[0] === 24) { // 0x18, Console/write
        if (typeof process !== 'undefined') { 
            process.stdout.write(String.fromCharCode(args[1]));
        } 
        yakuState.webState.outputBuffer+=String.fromCharCode(args[1]);
        // alert(String.fromCharCode(args[1]));
    } else if (args[0] === 15) { // 0x0f, System/state
        if (args[1] !== 0) {
            // process.exit(args[1] & 0x7f);
        }
    }
}

// 对应 sub deviceIn($args,$sz,$yakuState)
export function deviceIn(args, sz, yakuState) {
    if (args[0] === 4) { // System/wst
        return yakuState.Uxn.stacks[0].length;
    } else if (args[0] === 5) { // System/rst
        return yakuState.Uxn.stacks[1].length;
    } else {
        throw new Error(`Sorry, DEI for port ${args[0]} is not implemented in the yaku interpreter`);
    }
}

// 对应 our $callInstr = { ... }
export const callInstr = {
    'INC': [inc, 1, 1],
    'ADD': [add, 2, 1],
    'MUL': [mul, 2, 1],
    'SUB': [sub_, 2, 1],
    'DIV': [div, 2, 1],
    'SFT': [sft, 2, 1],
    'AND': [and_, 2, 1],
    'ORA': [ora, 2, 1],
    'EOR': [eor, 2, 1],
    'EQU': [equ, 2, 1],
    'NEQ': [neq, 2, 1],
    'LTH': [lth, 2, 1],
    'GTH': [gth, 2, 1],
    'DEO': [deviceOut, 2, 0],
    'DEI': [deviceIn, 1, 1],
    'JSR': [call, 1, 0],
    'JMP': [jump, 1, 0],
    'JCN': [condJump, 2, 0],
    'LDA': [load, 1, 1],
    'STA': [store, 2, 0],
    'LDR': [loadRel, 1, 1],
    'STR': [storeRel, 2, 0],
    'LDZ': [load, 1, 1],
    'STZ': [store, 2, 0],
    'STH': [stash, 0, 0],
    'DUP': [dup, 0, 0],
    'SWP': [swap, 0, 0],
    'ROT': [rot, 0, 0],
    'OVR': [over, 0, 0],
    'POP': [pop_, 0, 0],
    'NIP': [nip, 0, 0],
    'LIT': [lit, 0, 0],
    'JCI': [immediateCondJump, 1, 0],
    'JMI': [immediateJump, 0, 0],
    'JSI': [immediateCall, 0, 0],
};

