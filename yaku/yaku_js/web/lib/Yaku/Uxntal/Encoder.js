"use strict";

// 版本信息
const VERSION = "1.0.0";
const VV = (typeof process !== 'undefined' && process.env?.YAKU_VERBOSE)
  ? parseInt(process.env.YAKU_VERBOSE)
  : 0;


// 导入必要模块
import { WW, EE } from '../Flags.js';
import { 
    tokenTypes, opcode,
    MAIN, LIT, BANK, INSTR, LABEL, REF, IREF, RAW, ADDR, PAD, EMPTY, UNKNOWN, PLACEHOLDER, OPENBRACKET, CLOSEBRACKET
} from './Definitions.js';
import { 
    signedShortToShort2sComp,
    signedByteToByte2sComp,
    short2sComptToBytes2sComp,
    bytes2sCompToShort2sComp
} from '../IntegerFormatConversions.js';
import { toHex,prettyPrintToken, prettyPrintStr } from './PrettyPrint.js';

// 辅助函数（简化版本，避免循环依赖）
function prettyPrintTokenLOCAL(token) {
    if (!token || !Array.isArray(token)) return 'undefined';
    if (token[0] === LABEL) return '@' + token[1];
    if (token[0] === REF) return '.' + token[1];
    if (token[0] === LIT) return '#' + token[1].toString(16).padStart(token[2] === 2 ? 4 : 2, '0');
    if (token[0] === INSTR) return token[1] + (token[2] === 2 ? '2' : '') + (token[3] ? 'r' : '') + (token[4] ? 'k' : '');
    return token[1] ? token[1].toString() : token.toString();
}

function getLineForToken(token, yakuState) {
    if (yakuState.lineIdxs && token[token.length - 1] !== undefined) {
        const tokenIdx = token[token.length - 1];
        if (yakuState.lineIdxs[tokenIdx]) {
            const [lineIdx, fname] = yakuState.lineIdxs[tokenIdx];
            const displayName = fname === 'from_stdin.tal' ? 'STDIN' : fname;
            return ` on line ${lineIdx} of ${displayName}`;
        }
    }
    return " (line information not available)";
}

function isParentLabel(token) {
    return token[0] === LABEL && token[2] === 2;
}

function isParentRef(token) {
    return token[0] === REF && token[3] === 0;
}

function isInstr(token, instrName) {
    return token && token[0] === INSTR && token[1] === instrName;
}

function getChildSyntax(token) {
    let tokenStr = prettyPrintToken(token);
    tokenStr = tokenStr.replace(/^([,;=_-])[\w\-\_]+?\//, '$1&');
    return tokenStr;
}

// 主要导出函数 - 对应 sub tokensToMemory($tokens,$yakuState)
export function tokensToMemory(tokens, yakuState) {
    // 确保数据结构存在
    yakuState.symbolTable ??= {};
    yakuState.symbolTable.Labels ??= {};
    yakuState.symbolTable.Refs ??= {};
    yakuState.reverseSymbolTable ??= {};

    yakuState = populateMemoryAndBuildSymbolTable(tokens, yakuState);
    yakuState = resolveSymbols(yakuState);


    // 构建反向符号表 - 对应第一个for循环
if (yakuState.symbolTable?.Labels) {
    for (const symbol in yakuState.symbolTable.Labels) {
        const [pc, token] = yakuState.symbolTable.Labels[symbol];
        if (isParentLabel(token)) {
            yakuState.reverseSymbolTable[pc] = [token, 1];
        }
    }
}

    // 构建引用反向符号表 - 对应第二个for循环
    if (yakuState.symbolTable?.Refs) {
    for (const symbol in yakuState.symbolTable.Refs) {
        const [pcs, token] = yakuState.symbolTable.Refs[symbol];
        for (const pc of pcs) {
            if (isParentRef(token)) {
                // 检查是否用于JSR2, JSI, JMP2或JMI
                if (isInstr(yakuState.Uxn.memory[pc - 1], 'JSI') || isInstr(yakuState.Uxn.memory[pc + 3], 'JSR')) {
                    yakuState.reverseSymbolTable[pc] = [token, 2];
                } else if (isInstr(yakuState.Uxn.memory[pc - 1], 'JMI') || isInstr(yakuState.Uxn.memory[pc + 3], 'JMP')) {
                    yakuState.reverseSymbolTable[pc] = [token, 3];
                } else {
                    yakuState.reverseSymbolTable[pc] = [token, 0];
                }
            }
        }
    }
}

    return yakuState;
}

// 对应 sub populateMemoryAndBuildSymbolTable($tokens,$yakuState)
function populateMemoryAndBuildSymbolTable(tokens, yakuState) {
    // 初始化必要的数据结构
    if (!yakuState.symbolTable) {
        yakuState.symbolTable = { Labels: {}, Refs: {} };
    }
    if (!yakuState.reverseSymbolTable) {
        yakuState.reverseSymbolTable = {};
    }

    let pc = 0;
    let current_parent_label = '';
    let emptyLocs = 0;
    let no_warning=0;
    let use_warning=0;

    for (const token of tokens) {
        if (token[0] === OPENBRACKET){
            // console.warn('no_warning');
            no_warning=1;
        }
        if (token[0] === CLOSEBRACKET){
            // console.warn('use_warning');
            use_warning=1;
        }
        if (token[0] === MAIN) {
            pc = 0x0100;
        } else if (token[0] === ADDR) {
            if ( token[1]>0 && token[1] < pc) { // no error for |0000
                throw new Error(`Error: memory region marked with rune |${toHex(token[1],2)} overlaps with used memory. All addresses until ${toHex(pc,2)} are already used.`);
            }
            pc = token[1]; // set the pc to this address
        } else if (token[0] === PAD) {
            // 填充零字节 - 对应 for my $ii ( 0 .. $token->[1])
            for (let ii = 0; ii <= token[1]; ii++) {
                yakuState.Uxn.memory[pc + ii] = [RAW, 0, 1];
            }
            pc += token[1]; // increment the pc with this value
        } else if (token[0] === LABEL) {
            let labelName = token[1];
            if (token[2] === 2) { // parent label
                current_parent_label = labelName.replace(/\/.+$/,'');
            } else if (token[2] === 3) { // parent/child label
                current_parent_label = labelName.replace(/\/.+$/,'');
            } else { // child label
                const m = labelName.match(/\d+_LAMBDA/)
                labelName = 
                    m ?
                    labelName :
                    current_parent_label + '/' + labelName;
            }
            
            const token2 = [...token];
            token2[1] = labelName;
            const m = labelName.match(/\d+_LAMBDA/);
            const tokenStr = m ? '@' + labelName : prettyPrintToken(token2);
            
            if (!(labelName in yakuState.symbolTable.Labels)) {
                yakuState.symbolTable.Labels[labelName] = [pc, token];
            } else {
                if (token[2] >= 2) {
                    throw new Error(`Error: duplicate label ${tokenStr}, at lines ${yakuState.linesForToken?.[tokenStr]?.join(', ') || 'unknown'}`);
                } else {
                    throw new Error(`Error: duplicate child label ${tokenStr}, at lines ${yakuState.linesForToken?.['&' + token[1]]?.join(', ') || 'unknown'}`);
                }
            }
        } else if (token[0] === REF) {
            if (use_warning==1) { 
                token.push('use_warning'); 
                // console.warn('REF: ',token);
                use_warning=0;
            }
            if (no_warning==1) { 
                token.push('no_warning'); 
                // console.warn('REF: ',token);
                no_warning=0;
            }
            let labelName = token[1];
            if (token[3] && !labelName.includes('/')) {
                const m = labelName.match(/\d+_LAMBDA/) ? true : false;
                labelName = m ?
                labelName :
                current_parent_label + '/' + labelName;
            }
            token[1] = labelName;
            if (!(labelName in yakuState.symbolTable.Refs)) {
                yakuState.symbolTable.Refs[labelName] = [[pc], token];
            } else {
                yakuState.symbolTable.Refs[labelName][0].push(pc);
            }
            pc = storeToken(token, yakuState, pc);
        } else if (token[0] !== EMPTY
            && token[0] !== OPENBRACKET 
            && token[0] !== CLOSEBRACKET
        ) {
            // LIT => 1, INSTR => 2, RAW => 6
            if (use_warning==1) { 
                token.push('use_warning'); 
                // console.warn('NOREF: ',token);
                use_warning=0;
            }
            if (no_warning==1) { 
                token.push('no_warning'); 
                // console.warn('NOREF: ',token);
                no_warning=0;
            }
            pc = storeToken(token, yakuState, pc);
        } else {
            emptyLocs++;
        }
        
        if (pc > 0xffff) {
            throw new Error(`Memory capacity exceeded at token ${prettyPrintToken(token)}\nPC: ${pc} > 65535\nEmpty locations: ${emptyLocs}`);
        }
    }
    
    yakuState.Uxn.free = pc;
    return yakuState;
}

// 对应 sub resolveSymbols($yakuState)
function resolveSymbols(yakuState) {
    let i = 0;
    
    for (const token of yakuState.Uxn.memory) {
        if (token && token[0] === REF) {
            // 获取标签地址
            const labelInfo = yakuState.symbolTable.Labels[token[1]];
            if (!labelInfo) {
                if (opcode[token[1].substr(0, 3)]) {
                    const tokenStr = prettyPrintToken(token);
                    throw new Error(`Error: Invalid opcode ${tokenStr.includes('/') ? getChildSyntax(token) : tokenStr} at line ${getLineForToken(token, yakuState)}`);
                } else {
                    const tokenStr = prettyPrintToken(token);
                    throw new Error(`Error: label not defined for reference ${tokenStr.includes('/') ? getChildSyntax(token) : tokenStr} at line ${getLineForToken(token, yakuState)}`);
                }
            }
            
            let address = labelInfo[0]; // 获取地址
            const addr_mode = token[2]; // 地址模式 0 1 2 3 4 5
            
            if (addr_mode === 6) { // Immediate
                // TODO ADAPT FOR PAGING
                address -= i + 2;
                if (address > 32767 || address < -32768) {
                    const tokenStr = prettyPrintToken(token);
                    throw new Error(`Error: relative address too large for ${tokenStr} at line ${getLineForToken(token, yakuState)}`);
                }
                if (address < 0) {
                    address = signedShortToShort2sComp(address);
                }
            } else if (addr_mode === 1 || addr_mode === 4) { // relative address, 1 byte
                address -= i + 2;
                if (address > 127 || address < -128) {
                    const tokenStr = prettyPrintToken(token);
                    throw new Error(`Error: relative address ${address} is too large for ${tokenStr} at line ${getLineForToken(token, yakuState)}`);
                }
                if (address < 0) {
                    address = signedByteToByte2sComp(address);
                }
            }
            
            const word_sz = ((addr_mode === 2) || (addr_mode === 5) || (addr_mode === 6)) ? 2 : 1;
            storeToken([RAW, address, word_sz], yakuState, i);
        }
        i++;
    }
    
    return yakuState;
}

// 对应 sub storeToken($token,$yakuState,$addr)
export function storeToken(token, yakuState, addr) {
    let ttoken = [...token];
    if (ttoken[0] === LIT || (ttoken[0] === REF && ttoken[2] < 3)) {
        const word_sz = ttoken[0] === RAW 
            ? ttoken[2] 
            : ttoken[2] === 2 ? 2 : 1;
        const lit_instr_token = [INSTR, 'LIT', word_sz, 0, 0];
        if (/warn/.test(ttoken.at(-1))) {
            lit_instr_token.push(ttoken.at(-1));
        }
        yakuState.Uxn.memory[addr++] = lit_instr_token;
        if (ttoken[0] === LIT) {
            ttoken[0] = RAW;
        }
    }
    
    if (ttoken[0] === RAW || ttoken[0] === REF) { // If it is 2 bytes, we decompose
        const word_sz = (ttoken[0] === RAW)
            ? ttoken[2]
            : ((ttoken[2] === 2) || (ttoken[2] === 5) || (ttoken[2] === 6)) ? 2 : 1;
            
        if (word_sz === 2) {
            let tokenval_hi = ttoken[1];
            let tokenval_lo = ttoken[1];
            
            if (/^\d+$/.test(token[1].toString())) {
                [tokenval_hi, tokenval_lo] = short2sComptToBytes2sComp(token[1]);
            }
            
            const token_hi = [...token];
            token_hi[1] = tokenval_hi;
            if (token[0] === RAW) token_hi[2] = 1;
            yakuState.Uxn.memory[addr++] = token_hi;
            
            const token_lo = [...token];
            token_lo[1] = tokenval_lo;
            if (token[0] === RAW) token_lo[2] = 1;
            yakuState.Uxn.memory[addr++] = token_lo;
        } else {
            yakuState.Uxn.memory[addr++] = token;
        }
    } else if (ttoken[0] === INSTR) { // Always one byte
        yakuState.Uxn.memory[addr++] = token;
    } else if (ttoken[0] == PLACEHOLDER || ttoken[0] == EMPTY) { 
        // don't store
    } else {
        throw new Error(`Can't store a token of type ${tokenTypes[ttoken[0]]} in memory`);
    }
    
    return addr;
}

// 对应 sub loadToken($word_sz,$yakuState,$addr)
export function loadToken(word_sz, yakuState, addr) {
    let token = yakuState.Uxn.memory[addr] || [EMPTY, 0, 1];
    if (!WW && token[0] === EMPTY) {
        console.warn( `Warning: loading a ${word_sz === 1 ? 'byte' : 'short'} from empty memory location ${addr}`);
    }
    
    if (word_sz === 2) {
        const token_hi = [...token];
        const token_lo = [...(yakuState.Uxn.memory[addr + 1] || [EMPTY, 0, 1])];
        const tokenval_hi = token_hi[1];
        const tokenval_lo = token_lo[1];
        
        if (token_hi[0] === token_lo[0] && token_hi[0] !== INSTR) {
            const tokenval = bytes2sCompToShort2sComp(tokenval_hi, tokenval_lo);
            token = token_hi;
            token[1] = tokenval;
        } else if( token_hi[0]===EMPTY ) {
            if (!WW) {
                console.warn(`Warning: Combining empty byte ${tokenval_hi} with ${tokenval_lo} in ${prettyPrintToken(yakuState.Uxn.memory[yakuState.Uxn.pc])} ${getLineForToken(yakuState.Uxn.memory[yakuState.Uxn.pc],yakuState)}`);
            }
        } else if(  token_lo[0]===EMPTY ) {
            if (!WW) {
                console.warn(`Warning: Combining byte ${tokenval_hi} with empty byte ${tokenval_lo} in ${prettyPrintToken(yakuState.Uxn.memory[yakuState.Uxn.pc])} ${getLineForToken(yakuState.Uxn.memory[yakuState.Uxn.pc],yakuState)}`);
            }
        } else {
            if (!WW) {
                console.warn(`Warning: Combining bytes ${tokenval_hi} and ${tokenval_lo} in ${prettyPrintToken(yakuState.Uxn.memory[yakuState.Uxn.pc])} ${getLineForToken(yakuState.Uxn.memory[yakuState.Uxn.pc], yakuState)}`);
            }
            if (EE) process.exit(1);
            
            let hi_val = tokenval_hi;
            let lo_val = tokenval_lo;
            
            if (token_hi[0] === INSTR) {
                hi_val = opcode[tokenval_hi] || 0;
            }
            if (token_lo[0] === INSTR) {
                lo_val = opcode[tokenval_lo] || 0;
            }
            
            const tokenval = bytes2sCompToShort2sComp(hi_val, lo_val);
            token = token_hi;
            token[1] = tokenval;
        }
    }
    
    return token;
}