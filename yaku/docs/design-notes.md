# Design Notes — Call Stack Trace for the Yaku Web Interpreter

**Project:** uxn-1 — Call Stack for Uxn (JavaScript)
**Student:** Zechao Wu **Supervisor:** Wim Vanderbauwhede

## 1. Problem statement

Yaku is a JavaScript interpreter for Uxntal, the assembly language of the Uxn
virtual machine. When a program reaches a `BRK` instruction, the web version
currently gives the user no information about *how* execution arrived there —
there is no visible call chain.

The goal of this project is: when a program hits `BRK`, show the full chain of
active function calls in the web interface, including, for each call, the
function name, its arguments, and the source line number.

A key design constraint (agreed with the supervisor) is to maintain a
**separate, interpreter-level call stack** rather than repurposing the Uxn
return stack. The return stack is part of the virtual machine's semantics and
also holds non-call data; reusing it would be fragile and mix concerns.

## 2. Codebase map (where calls, returns and BRK are handled)

| Concern | File | Function |
|---|---|---|
| Main execution loop | `Interpreter.js` | `runProgram()` |
| Function call (`JSR`) | `Interpreter.js` | in `runProgram()` loop — pushes the callee name |
| Return (`RTN`) | `Interpreter.js` | in `runProgram()` loop — pops the call stack |
| `BRK` handling (stops execution) | `Interpreter.js` | `executeInstr()`, BRK case |
| Interpreter state container | `State.js` | `initYakuState()` |
| Token → memory encoding | `Encoder.js` | `tokensToMemory()` |
| Source parsing | `Parser.js` | `parseUxntalProgram()`, `stripCommentsFSM()` |
| Macro expansion | `MacroExpander.js` | `expandMacros()` |
| Web UI | `web/index.html`, `web/app.js`, `web/yaku.css` | — |

Note: the web page loads `yaku.css` (not `style.css`).

## 3. Initial design

- Keep the call stack in interpreter state as `yakuState.callStack`, separate
  from the Uxn return stack.
- On `JSR`, push a frame; on `RTN`, pop a frame.
- Evolve each frame from a bare function-name string into a structured object:
  `{ functionName, args, line }`.
  - `functionName`: resolved from the reverse symbol table.
  - `args`: a snapshot of the working stack at call time. (Uxntal has no
    function signatures, so this is honestly a stack snapshot, not named
    parameters.)
  - `line`: source line number, via a program-counter → line map built at
    encode time.
- When `BRK` is reached, read `yakuState.callStack` and render it in a new
  "Call Stack" panel in the web UI.

## 4. Requirements (MoSCoW)

**Must have**
- When a program reaches `BRK`, display the chain of active function calls
  (by name) in the web interface.

**Should have**
- Show the arguments of each call (working-stack snapshot).
- Show the source line number of each call.

**Could have**
- Clickable, VS Code-style breakpoints in a line-number gutter.

**Won't have (this project)**
- True named parameters (not possible without function signatures in Uxntal).
- A separate frame for conditional lambda blocks `?{ }`: these use conditional
  jumps rather than tracked `JSR`, so `BRK` inside them shows the enclosing
  function frame. This is a documented limitation.