"use strict";

const VERSION = "1.0.0";

export function expandMacros(tokenStrings) {
    let macroDefs = {};
    let tidx = 0;
    let tokenStrings_no_macro_defs = [];
    while (tidx< tokenStrings.length) {        
        let tokenString = tokenStrings[tidx];
        if (tokenString.match(/^\%/)) {
            let macro = tokenString.substring(1);
            let ii = tidx+1;
            let ttokenString = tokenStrings[ii];
            while (ttokenString !== '{') {
                ttokenString = tokenStrings[++ii];
            }
            ttokenString = tokenStrings[++ii];
            let brace_count=1;
            let macro_tokenStrs = [];
            while ( brace_count!=0) {
                if (ttokenString === '{') { brace_count++ }
                if (ttokenString === '}') { brace_count-- }
                if ( brace_count!=0) {
                    macro_tokenStrs.push( ttokenString);
                }
                ttokenString = tokenStrings[++ii];
            }
            macroDefs[macro] = macro_tokenStrs;
            tidx=ii-1;
        } else {
            tokenStrings_no_macro_defs.push(tokenString);
        }
         
         tidx++;
    }

    let macroContainsMacros = [];
    for ( const macro in macroDefs ) {
        let macro_tokenStrs =  macroDefs[macro];
        for (const macro_tokenStr of macro_tokenStrs) {
            
            if (macro_tokenStr in macroDefs) {
                macroContainsMacros[macro]=1;
            }
        }
    }
    
    let tokenStrings_before_expansion = [...tokenStrings_no_macro_defs];
    let tokenStrings_after_expansion = [];
    let tokenStrings_contain_macros = 1;
    while (tokenStrings_contain_macros==1) {
        tokenStrings_contain_macros = 0;        
        for (const tokenString  of tokenStrings_before_expansion) {
            if (!(tokenString in macroDefs)) {
                tokenStrings_after_expansion.push( tokenString);
            } else {
                if (tokenString in macroContainsMacros) {
                    tokenStrings_contain_macros = 1;
                }
                let macro_tokenStrs =  macroDefs[tokenString];
                tokenStrings_after_expansion = [...tokenStrings_after_expansion, ...macro_tokenStrs];
            }
        }
       if (tokenStrings_contain_macros==1) {        
            tokenStrings_before_expansion = [...tokenStrings_after_expansion];
            tokenStrings_after_expansion = [];
        }
    }
    
    return tokenStrings_after_expansion;
} // END of expandMacros()
