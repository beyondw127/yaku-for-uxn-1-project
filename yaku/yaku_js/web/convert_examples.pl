#!/usr/bin/env perl
use strict;
use warnings;
use v5.30;

while (my $line=<>) {
	next if $line=~/^\}/;
if (
	$line=~/let\s+examples/) {$line=~s/let/export const/
}
elsif ($line=~/\"(\d+\.\s+)(.+?)\":/ ) {
	my $example_id = $2;
	my $example_name = $1.$example_id;
	$example_id =~s/^.\s+//;
	$example_id =~s/\s+/-/g;
	$example_id =~s/[\/\&]/-/g;
	$example_id = lc($example_id);
	warn '<option value="'.$example_id.'">'.$example_name.'</option>'."\n";
	$line=~s/:\s+\`/,\ncode: `/;	
	$line = "'".$example_id."': { \nname: ".$line;
} elsif ($line=~/\`/ ) {
	$line=~s/\`/\nBRK`\n}/;
} 
	print $line;
}

print << 'END_EX';
,
 'hello-world-2': {
            name: 'Hello World',
            code: `( Hello World Example )
|0100 ( -> )
    ;hello-str ;print-str JSR2
BRK

@print-str ( str* -> )
    &loop
        DUP2 LDA DUP #00 EQU ,&end JCN
        #18 DEO 
        INC2 ,&loop JMP
    &end
        POP POP2 JMP2r

@hello-str "Hello, 20 "World! 00`
        },
        'simple-calc': {
            name: 'Simple Calculation',
            code: `( Simple Calculation )

|0100

@main
    #06 #07 MUL  ( 6 * 7 = 42 )
    #18 DEO      ( Output '*' )
    #0a #18 DEO  ( Output newline )
    BRK`
        },
        'fibonacci': {
            name: 'Fibonacci Sequence',
            code: `( Fibonacci Example )

|0100

@main
    #06 ;fibonacci JSR2  ( Calculate fib(6) )
    #30 ADD #18 DEO     ( Convert to ASCII and output )
    BRK

@fibonacci ( n -> fib_n )
    DUP #02 LTH ,&base-case JCN
    DUP #01 SUB ,fibonacci JSR
    SWP #02 SUB ,fibonacci JSR
    ADD JMP2r
    &base-case JMP2r`
        },
        'memory-access': {
            name: 'Memory Access',
            code: `( Memory Access )

|0100

@main
    #2a ;data STA    ( Store 42 in memory )
    ;data LDA        ( Load from memory )
    #18 DEO          ( Output the value )
    BRK

|0200
@data $1`
        }
};
		
END_EX