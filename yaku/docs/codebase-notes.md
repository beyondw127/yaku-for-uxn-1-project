# Yaku Codebase Notes — Call Stack Trace Project

Working notes that map the parts of the Yaku interpreter relevant to adding a
call-stack trace. Paths are relative to `yaku_js/web/`. Line numbers are a guide
and may drift as the code changes.

> These notes are a **map, not a substitute for reading the code**. Open each
> referenced file yourself and confirm. The `TODO (verify)` items at the end are
> things to check by hand so the understanding is genuinely yours.

---

## 1. High-level architecture

The web app is a thin UI on top of a JavaScript port of the Yaku Uxntal
assembler/interpreter.

| File | Role |
| --- | --- |
| `app.js` | Browser glue: buttons, reads code, calls `mainForWeb`, renders output. |
| `lib/Yaku.js` | Entry points `main` (CLI) and `mainForWeb` (web); drives parse → assemble/run. |
| `lib/Yaku/Uxntal/Parser.js` | Parses `.tal` source text into tokens; tags each token with `[fileId, lineNumber]`. |
| `lib/Yaku/Uxntal/Encoder.js` | `tokensToMemory`; builds `symbolTable` and `reverseSymbolTable`. |
| `lib/Yaku/Uxntal/Interpreter.js` | `runProgram` / `executeInstr`; the execution loop. **Call-stack work lives here.** |
| `lib/Yaku/Uxntal/Actions.js` | One function per opcode (`call`, `jump`, `add`, `deviceOut`, ...). |
| `lib/Yaku/Uxntal/ErrorChecking.js` | `checkErrors`, `getLineForToken`. |
| `lib/Yaku/Uxntal/Definitions.js` | Constants: `LIT/INSTR/RAW`, `opcodes`, `stack_operations`. |
| `lib/Yaku/Uxntal/State.js`, `Uxn.js` | Shape of `yakuState` and the Uxn VM (`memory`, `stacks`, `pc`, ...). |

---

## 2. Execution pipeline (what happens on "Execute")

```
app.js  executeBtn.onclick
   -> mainForWeb(programFile, code, opts)            [Yaku.js]
        -> parseUxntalProgram(...)                   [Parser.js]   (text -> tokens, tagged with line)
        -> interpretOrAssembleTokens(...)            [Yaku.js]
             -> tokensToMemory(tokens, yakuState)    [Encoder.js]  (builds reverseSymbolTable)
             -> runProgram(yakuState)                [Interpreter.js]
   -> returns yakuState
app.js  reads yakuState.webState.outputBuffer / warningsBuffer / errorsBuffer
        and renders via addOutput(...) and updateStacksOutput()
```

---

## 3. The five points that matter for the call stack

1. **Parse source** — `Parser.js` (tokens get `[fileId, lineNumber]`, ~line 175).
2. **Execute one instruction** — `Interpreter.js` `executeInstr` (~line 151).
3. **Function CALL** — opcode logic in `Actions.js` `call` (JSR/JSR2) and
   `immediateCall` (JSI); the *call-stack push* is in `Interpreter.js` `runProgram`
   (~lines 90–102).
4. **Function RETURN** — `JMP2r` and tail-call detection in `Interpreter.js`
   `runProgram` (~lines 114–131); the actual return-stack pop is in `Actions.js` `jump`.
5. **BRK** — `Interpreter.js` `executeInstr` (~line 154) returns `[0, ...]`, and
   `runProgram` breaks out of the loop (~line 134).
6. **Output to web** — `app.js` `addOutput` (~line 206) and `updateStacksOutput`
   (~line 263).

---

## 4. The existing call-stack scaffold (the key starting point)

`Interpreter.js` → `runProgram` already maintains a call stack:

```js
let current_parent = 'MAIN';
const call_stack = ['MAIN'];   // ~line 60
```

- Pushes a function name on `JSR2` / `JSI` (~lines 90–102), looked up via
  `reverseSymbolTable[pc]`.
- Pops on `JMP2r` and on a `STH...JMP2` tail-call pattern (~lines 114–131).

What it is **missing** (this is essentially the project):

- It is a **local variable**, not attached to `yakuState`, so nothing outside
  `runProgram` can see it.
- It stores **names only** — and the name still carries the `;` ref prefix
  (e.g. `";outer"` instead of `outer`).
- No **arguments**, no **line number** per frame.
- It is **never snapshotted at BRK** and **never sent to the web** or displayed.

---

## 5. Where each piece of data comes from

- **Function name** — `reverseSymbolTable`, built in `Encoder.js` (~lines 67–98)
  as `reverseSymbolTable[pc] = [token, type]`.
- **Line number** — tokens are tagged `[fileId, lineNumber]` in `Parser.js`,
  and `getLineForToken` lives in `ErrorChecking.js` (line 294). **Caveat:** that
  function indexes with `token[-1]` / `token[-2]` (Perl-style negative indexing),
  which is `undefined` in JavaScript, so runtime line lookup does not work as-is.
  Evidence: runtime warnings print `... in MAIN` with **no** `on line N`. Getting
  per-frame line numbers will likely need a `pc -> line` map built during encoding.
- **Arguments** — there is no separate argument list in Uxn; the arguments are
  whatever is on the **working stack** (`yakuState.Uxn.stacks[0]`) at call time.
  A snapshot of (the top of) the working stack at the JSR is the natural choice.

---

## 6. BRK semantics (important, easy to get wrong)

`BRK` **halts the program** — `executeInstr` returns `[0]`, `runProgram` breaks.
It is *not* a pause-and-resume breakpoint.

Consequence: the call stack captured at a BRK is the **live call chain at that
halt point**, exactly like a debugger backtrace.

- BRK at the end of `main` → stack is just `[MAIN]` (all functions have returned).
- BRK *inside* a function → full path, e.g. `[MAIN, outer, inner]`.

Verified with `tests/callstack/brk_inside_function.tal`, which produces
`["MAIN", ";outer", ";inner"]` at the BRK.

The call stack is maintained continuously on every call/return, so it is correct
at any point — wherever the single active BRK lands, the snapshot is right. You do
**not** instrument every function; you place one breakpoint where you want to look.

---

## 7. Planned changes (minimal, in order)

1. Turn `call_stack` into a stack of structured **frames**
   `{ functionName, args, line }` and attach it to `yakuState`.
2. On BRK, snapshot it into `yakuState.webState.callStackTrace`.
3. Clean the function name (strip the `;` ref prefix).
4. Build a `pc -> line` map (in `Encoder.js`) so each frame can carry a line number.
5. Display: add `updateCallStackOutput()` in `app.js`, a panel in `index.html`,
   styling in `yaku.css`.

---

## 8. Open design questions (move these into `design-notes.md`)

- **Logical call path vs physical return-stack frames.** The scaffold collapses
  tail-call chains (`f_2 -> f_1 -> f_3 -> ...`) into a single frame. Show the
  logical path, the physical frames, or both? Pick one and justify it.
- **What counts as "arguments"** — the whole working stack, or the top N items?
- **One trace per run** (BRK halts) vs a non-halting breakpoint that captures the
  trace and continues. The second is an optional enhancement, not Must-have.

---

## TODO (verify by hand)

- [ ] Open `Interpreter.js`, read `runProgram`, and confirm the exact push/pop
      conditions for JSR2 / JSI / JMP2r / tail call.
- [ ] Open `Encoder.js` and confirm where `reverseSymbolTable` is filled.
- [ ] Run `node bin/yaku.js -r ../../tests/ex06_subroutine-call.tal` and watch the
      output; then try `tests/callstack/brk_inside_function.tal`.
- [ ] Check whether `getLineForToken` ever returns a real line at runtime, or always `"\n"`.
