"use strict";

const VERSION = "1.0.0";

// 导入模块
import {
    tokenTypes, refTypes, opcode,
    MAIN, LIT, INSTR, LABEL, REF, RAW, PAD, EMPTY, OPENBRACKET, CLOSEBRACKET
} from './Definitions.js';
import { EE } from '../Flags.js';

// 辅助函数
// WV: TODO: use the implementations from PrettyPrint!
function prettyPrintStr(tokens, mode) {
    return tokens.map(t => Array.isArray(t) ? (t[1] || t.toString()) : t.toString()).join(' ');
}
// WV: TODO: use the implementations from PrettyPrint!
function prettyPrintToken(token) {
    if (!token || !Array.isArray(token)) return 'undefined';
    if (token[0] === LABEL) return '@' + token[1];
    if (token[0] === REF) return '.' + token[1];
    if (token[0] === LIT) return '#' + token[1].toString(16).padStart(token[2] === 2 ? 4 : 2, '0');
    if (token[0] === INSTR) return token[1] + (token[2] === 2 ? '2' : '') + (token[3] ? 'r' : '') + (token[4] ? 'k' : '');
    return token[1] ? token[1].toString() : token.toString();
}

// export function getLineForToken(token, yakuState) {
//     if (!token || !Array.isArray(token)) {
//         return " (invalid token)";
//     }
    
//     const tokenIdx = token[token.length - 1];
//     if (yakuState.lineIdxs && yakuState.lineIdxs[tokenIdx]) {
//         const [lineIdx, fname] = yakuState.lineIdxs[tokenIdx];
//         const line = yakuState.linesPerFile?.[fname]?.[lineIdx - 1] || '';
//         const displayName = fname === 'from_stdin.tal' ? 'STDIN' : fname;
//         return " on line " + lineIdx + " of " + displayName + ": " + line;
//     } else {
//         return " (line information not available)";
//     }
// }

// 主要检查函数
export function checkErrors(tokens, yakuState) {
    yakuState = buildAllocationTable(tokens, yakuState);

    let current_parent = '';
    let errors = [];
    let warnings = [];
    let unique_errors = {};
    let unique_warnings = {};
    let found_main = false;
    let skip_checks = false;

    for (let idx = 0; idx < tokens.length; idx++) {
        
        const token = tokens[idx];
        const next_token = (idx + 1 < tokens.length) ? tokens[idx + 1] : [EMPTY, 0, 0];
        const prev_token = tokens[idx - 1];

        if (token[0] === MAIN) {
            found_main = true;
        }
        if (token[0] === OPENBRACKET) {
            // console.warn('OPENBRACKET');
            skip_checks = true;
        }
        if (token[0] === CLOSEBRACKET) {
            // console.warn('CLOSEBRACKET');
            skip_checks = false;
        }
        // 零页写入检查
        if (yakuState.hasMain === 1 && !found_main && token[0] === RAW) {
            const error_str = 'Writing raw values in the zero page is not allowed: ' + 
                prettyPrintToken(token) + getLineForToken(token, yakuState);
                [errors,unique_errors] = _push_if_unique(error_str,errors,unique_errors);
        }
        // 父标签处理
        else if (token[0] === LABEL && token[2] === 2) {
            current_parent = token[1].replace(/\/.+$/,'');
        }
        // 堆栈常量后跟加载/存储错误
        else if (token[0] === LIT && next_token[0] === INSTR && 
                  /(?:LD|ST)[ARZ]/.test(next_token[1]) && !skip_checks) {
            const error_str = 'Stack constant followed by load or store:' + 
                prettyPrintStr([token, next_token], 1) + getLineForToken(token, yakuState);
            [errors,unique_errors] = _push_if_unique(error_str,errors,unique_errors);
        }
        // 原始常量后跟加载/存储错误
        else if (token[0] === RAW && next_token[0] === INSTR && 
                  /(?:LD|ST)[ARZ]/.test(next_token[1]) && !skip_checks) {
            const error_str = 'Raw constant followed by load or store:' + 
                prettyPrintStr([token, next_token], 1) + getLineForToken(token, yakuState);
            [errors,unique_errors] = _push_if_unique(error_str,errors,unique_errors);
        }
        // 引用检查
        else if (token[0] === REF) {
            const accessMode = ['Z', 'R', 'A', 'Z', 'R', 'A', ''];
            
            if (next_token[0] === INSTR && /(LD|ST)([ARZ])/.test(next_token[1])) {
                const match = next_token[1].match(/(LD|ST)([ARZ])/);
                const a_mode = match[2];
                
                if (token[2]!==6 && a_mode !== accessMode[token[2]] && !skip_checks) {
                    const error_str = prettyPrintToken(next_token) + ' has address with incompatible reference mode ' + 
                        prettyPrintToken(token) + getLineForToken(token, yakuState);
                    [errors,unique_errors] = _push_if_unique(error_str,errors,unique_errors);
                }

                // 分配检查
                const name = (token[3] === 1 && current_parent !== '') ? 
                    current_parent + '/' + token[1] : token[1];
                const alloc_sz = yakuState.allocationTable?.[name] || 0;
                const word_sz = next_token[2];
                
                if (token[2] < 3) {
                    if (alloc_sz === 0 && !skip_checks) {
                        const error_str = 'No allocation for reference:' + 
                            prettyPrintStr([token, next_token], 1) + 
                            getLineForToken(next_token, yakuState) + " <" + name + ">";
                        [errors,unique_errors] = _push_if_unique(error_str,errors,unique_errors);
                    } else if (alloc_sz < word_sz && !skip_checks) {
                        const error_str = 'Allocation is only a byte, access is a short:' + 
                            prettyPrintStr([token, next_token], 1) + 
                            getLineForToken(next_token, yakuState);
                        [errors,unique_errors] = _push_if_unique(error_str,errors,unique_errors);
                    } else if (alloc_sz > word_sz && alloc_sz === 2 && !skip_checks) {
                        const warning_str = 'Allocation is larger than access size: ' + 
                            prettyPrintStr([token, next_token], 1) + 
                            getLineForToken(next_token, yakuState);
                        console.warn(warning_str);
                        [warnings,unique_warnings] = _push_if_unique(warning_str,warnings,unique_warnings);
                    } else if (
                        /ST/.test(next_token[1]) &&
                        prev_token[0] === LIT
                        && !skip_checks) {
                        if (prev_token[2] > alloc_sz ) {
                            const warning_str =  'Allocation size smaller than size of constant to be stored:'.prettyPrintStr([prev_token,token,next_token],1)
                            .getLineForToken(next_token,yakuState);
                            [warnings,unique_warnings] = _push_if_unique(warning_str,warnings,unique_warnings);

                        }
                        if (prev_token[2] != word_sz ) {
                            const warning_str = 'Store size different from size of constant to be stored:'.prettyPrintStr([prev_token,token,next_token],1)
                            .getLineForToken(next_token,yakuState);
                            [warnings,unique_warnings] = _push_if_unique(warning_str,warnings,unique_warnings);
                        }
                    }
                }
            }
            // 跳转指令检查
            else if (next_token[0] === INSTR 
                && /(JMP|JCN|JSR)/.test(next_token[1])
                && !skip_checks) {
                if (token[2] === 1 && next_token[2] !== 1) {
                    const error_str = prettyPrintToken(next_token) + ' has address with incompatible reference mode ' + 
                        prettyPrintToken(token) + getLineForToken(token, yakuState);
                    [errors,unique_errors] = _push_if_unique(error_str,errors,unique_errors);
                } else if (token[2] === 2 && next_token[2] !== 2) {
                    const error_str = prettyPrintToken(next_token) + ' has address with incompatible reference mode ' + 
                        prettyPrintToken(token) + getLineForToken(token, yakuState);
                    [errors,unique_errors] = _push_if_unique(error_str,errors,unique_errors);
                }
            }
        }
        // SFT指令检查
        else if (token[0] === LIT 
            && next_token[0] === INSTR 
            && /SFT/.test(next_token[1])
            && !skip_checks) {
            if (token[2] === 2) {
                const error_str = 'Second argument of SFT must be a byte:' + 
                    prettyPrintStr([prev_token, token, next_token], 1) + 
                    getLineForToken(token, yakuState);
                [errors,unique_errors] = _push_if_unique(error_str,errors,unique_errors);
            }
            if (
                ( prev_token[0] === LIT  ||
                ( prev_token[0] === INSTR && /LD/.test(prev_token[1]))
                )                
                && prev_token[2] != next_token[2]
            ) {
                const warning_str = 'SFT short mode not compatible with size of first argument:'.prettyPrintStr([prev_token,token,next_token],1)
                .getLineForToken(token,yakuState);
                [warnings,unique_warnings] = _push_if_unique(warning_str,warnings,unique_warnings);
            }
        }
    }

    // 处理警告和错误
    /*
    if (warnings.length > 0) {
        for (const warning of warnings) {
            console.warn("Warning: " + warning);
        }
        if (EE) process.exit(1);
    }
    
    if (errors.length > 0) {
        for (const error of errors) {
            console.error("Error: " + error);
        }
        process.exit(1);
    }
        */
    return [warnings,errors]
}

function _push_if_unique(warning_str,warnings,unique_warnings) {
    if ( unique_warnings[warning_str] === undefined ) {
        warnings.push(warning_str);
        unique_warnings[warning_str]=1;
    }
    return [warnings,unique_warnings]
}

function buildAllocationTable(tokens, yakuState) {
    let current_parent = '';
    let current_cfqn = '';
    yakuState.allocationTable = {};
    let prev_consecutive_label = '';
    
    for (let idx = 0; idx < tokens.length; idx++) {
        const token = tokens[idx];
        const next_token = (idx + 1 < tokens.length) ? tokens[idx + 1] : [EMPTY, 0, 0];
        
        if (token[0] === LABEL) {
            if (token[2] === 2) { // parent
                current_parent = token[1].replace(/\/.+$/,'');
                current_cfqn = '';
            } else if (token[2] === 3) { // parent/child
                current_cfqn = token[1];
            } else {
                current_cfqn = current_parent + '/' + token[1];
            }
            
            if (next_token[0] === PAD) {
                const name = current_cfqn !== '' ? current_cfqn : current_parent;
                yakuState.allocationTable[name] = next_token[1];
            } else if (next_token[0] === RAW) {
                const name = current_cfqn !== '' ? current_cfqn : current_parent;
                yakuState.allocationTable[name] = next_token[2];
            } else if (next_token[0] === REF && next_token[2]>3) { // includes immediate, but that should never happen
                // We set this to 2 as a minimal allocation
                const name = current_cfqn !== '' ? current_cfqn : current_parent;
                yakuState.allocationTable[name] = 2;              
            } else if (next_token[0] === LABEL) {
                prev_consecutive_label = (token[2] === 2) ? current_parent : current_cfqn;
                continue;
            } else {
                const name = current_cfqn !== '' ? current_cfqn : current_parent;
                yakuState.allocationTable[name] = 0;
            }
            
            if (prev_consecutive_label !== '') {
                const currentAlloc = current_cfqn !== '' 
                    ? yakuState.allocationTable[current_cfqn]
                    : yakuState.allocationTable[current_parent];
                yakuState.allocationTable[prev_consecutive_label] = currentAlloc;
                prev_consecutive_label = '';
            }
        }
    }
    
    return yakuState;
}

// export function getLinesForTokens(programText) {
//     const linesForToken = {};
//     const lines = programText.split('\n');
    
//     for (let i = 0; i < lines.length; i++) {
//         const line = lines[i].replace(/\s*\(.+?\)\s*$/, '');
//         const tokens = line.split(/\s+/).filter(t => t.length > 0);
        
//         for (const token of tokens) {
//             if (token.startsWith('"')) {
//                 const chars = token.substr(1).split('');
//                 for (const char of chars) {
//                     const hexChar = char.charCodeAt(0).toString(16).padStart(2, '0');
//                     if (!linesForToken[hexChar]) linesForToken[hexChar] = [];
//                     linesForToken[hexChar].push(i + 1);
//                 }
//             } else {
//                 if (!linesForToken[token]) linesForToken[token] = [];
//                 linesForToken[token].push(i + 1);
//             }
//         }
//     }
    
//     return linesForToken;
// }

export function  getLineForToken(token,yakuState) {
        
    const tokenFileLineId = /warning/.test(token[-1]) ? token[-2] : token[-1];
    if (Array.isArray(tokenFileLineId)) {
        const [fileId,lineId] = tokenFileLineId;
        if ( (yakuState[sourceCodeLinesPerFile][fileId] === undefined)
            || ( yakuState[sourceCodeLinesPerFile][fileId][lineId-1] === undefined)
        ) {
            return '';
        }
        
        let fname = yakuState[sourceCodeFileNames][fileId];
        const line = yakuState[sourceCodeLinesPerFile][fileId][lineId-1];
        fname = fname === 'from_stdin.tal' ? 'STDIN' : fname;
        return (lineId>0? ` on line ${lineId} of fname:\n\t${line}\n` : ` in ${fname}\n`) ;
    } else {
       return "\n";
    }
}