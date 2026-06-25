# yaku

`yaku` is an [Uxntal](https://wiki.xxiivv.com/site/uxntal.html) assembler and command line interpreter. You can use it instead of [uxnasm](https://git.sr.ht/~rabbits/uxn) or [drifblim](https://git.sr.ht/~rabbits/drifblim) to assemble Uxntal code for running on any of the [many Uxn VM implementations](https://github.com/hundredrabbits/awesome-uxn#emulators), or you can use it to run non-graphical Uxntal programs directly, like a combination of assembler and [uxncli](https://git.sr.ht/~rabbits/uxn).

## Running yaku

`yaku` is written in [Perl](https://www.perl.org/) and has no external dependencies but is split over several source files. To run it, you will need a reasonably recent `perl` (5.30 or later).

		perl -I<path to the folder containing Yaku.pm> <path to the folder containing yaku.pl> <options> <.tal file>
	
For example, to run any of the test files:

		cd tests
		perl -I../lib ../bin/yaku.pl -r ex00_basics.tal
		
## Command-line flags

        -r: run the program. This only supports programs that run on uxncli, no graphics.
        -a: assemble the program into a .rom, for execution with one of the Uxn VM implementations.
        -D: don't write .rom (for test/debug)
        -v: verbose 
        -V: more verbose
        -d: debug messages too
        -s: show the stacks at the end of the run
        -O: turn on optimisations (This is experimental. Without the flag, they are not enabled; they will almost certainly break your code.)
        -p: print generated code and exit
        -W: fewer warning and error messages. By default, yaku reports common errors for learning purposes. Some of these are strictly speaking not errors.
        -i: take input from stdin instead of a file. You can provide a one-liner via a pipe or redirect.

## Limitations

Currently, `yaku` does not support Uxntal macros. 
			
## Tests

- To run the tests, you need `uxnasm` and `uxncli` in your `PATH` as they are used as the reference.

- To run all tests in the `tests` folder:

    perl ./run_tests.pl -[aqs]
    
    -a runs the assembler, and executes the rom using uxncli
    -q stops if an failing test is encountered
    -s lets you provide a single test on command line
    
- To run specific tests for the various error messages:

    - The tests that came with the `drifblim` version of 24 April 2025
    
        ./drifblim_tests.sh
    
    - Tests for other common errors (which might by now already be in drifblim as well ^_^)
    
        ./common_error_tests.sh 
    
## Installation

There is a JavaScript version of `yaku`. It is considerably faster (a the expense of using a lot more memory), so you'll probably want to use that instead of the Perl version. Because I use both, I have use Perl wrapper.

Perl finds locally installed libraries using the environment variable `PERL5LIB`. Assuming you have set this, for example to `$HOME/perl5/lib/perl5`, then you can simply copy all files from the `lib` folder in the source repository over there.

 		cp lib/Yaku.pm ~/perl5/lib/perl5/
 		cp -r lib/Yaku ~/perl5/lib/perl5/

Copy the script `yaku.pl` from  the `lib` folder in the source repository to any folder in your `PATH` variable, I use `$HOME/perl5/bin` or `$HOME/.local/bin`. I personally leave off the `.pl` extension for installed scripts, so I  do

		cp bin/yaku.pl ~/perl5/bin/yaku  
		  
To use the JavaScript version with this wrapper, install it in `$HOME/.local` or set the `YAKU_JS_DIR` environment variable to wherever you want to have it.

    cp -r yaku_js/web/lib/Yaku ~/.local/lib
    cp -r yaku_js/web/bin/yaku.js ~/.local/bin/
    cp yaku_js/web/package.json  ~/.local/bin/
    cp yaku_js/web/package.json  ~/.local/lib/

If you install `yaku` as above, you can simply run	

		yaku <options> <.tal file>
		
and by default this will run the JavaScript version using either `bun`, `deno` or `node` (in that order).

- To run the Perl version, set the `YAKU` environment variable to `YAKU=Perl`. 
- To provide a different JavaScript runtime, set the `YAKU_JS_RUNTIME` environment variable.	
		
## Name

I call it `yaku` afther the Japanese phrase 役に立つ, _yaku ni tatsu_ which means to be helpful or useful.

