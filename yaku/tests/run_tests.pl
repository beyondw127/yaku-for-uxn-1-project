#!/usr/bin/env perl
use warnings;
use strict;
use v5.30;

use integer;

no warnings qw(experimental);
use feature qw(signatures);

use Data::Dumper;
use Carp;
use Getopt::Std;

my %opts = ();
getopts( 'vwVdahsqO0123YF', \%opts );

if ($opts{'h'}) {
    die "-a tests assembler, default tests interpreter\n-q quits on first error\n-V suppresses printing of the test name\n-F shows only failed tests\n-s <name> single .tal file\nYaku options: -Y, -O";
}
# our $WW = $opts{'w'} ? 1 : 0;
# our $V = $opts{'v'} ? 1 : 0;
our $VV = $opts{'V'} ? 1 : 0;
# our $DBG = $opts{'d'} ? 1 : 0;
our $failOnly = $opts{'F'} ? 1 : 0;
our $yakuOpts = $opts{'Y'} ? '-Y' : '';
$yakuOpts .=  ' -O' if $opts{'O'};
$yakuOpts .= '0' if $opts{'0'};
$yakuOpts .= '1' if $opts{'1'};
$yakuOpts .= '2' if $opts{'2'};
$yakuOpts .= '3' if $opts{'3'};
our $testAssembler = $opts{'a'} ? 1 : 0; # default tests interpreter
our $quit = $opts{'q'} ? 1 : 0 ;
our $single = $opts{'s'} ? 1 : 0 ;
if ($single and not @ARGV) {
    die "Provide the .tal file to test on command line\n";
}
my @programFiles= $single ? ( $ARGV[0] ) : glob('*.tal');
my $n_tests_run=0;
my $n_fails=0;
my $n_passes=0;
for my $programFile (@programFiles) {
    next if $programFile=~/test_console_device.tal/;
#next if $opts{'O'} and $programFile=~/fractran/;
    ++$n_tests_run;
    my $romFile = $programFile;
    $romFile =~s/\.tal/.rom/;
    # next if $programFile=~/ex20_1_rel_abs_labels.tal/;
    next if $programFile=~/dbg/i;
    say "$n_tests_run. $programFile" unless $VV;
    # open my $fh, '<', $programFile or die "Can't open file $!";
    my @ref = `uxnasm $programFile tmp.rom && uxncli tmp.rom`;
    my $ref_str='';
    for my $refl (@ref) {
        chomp $refl;
        next if $refl=~/Unused/;
        next if $refl=~/macros/;
        $refl=~s/^\s+//msg;
        # say "<$refl>";
        $ref_str.=$refl;
    }
    my @res;
    if ($testAssembler) {
        @res = `perl -I../lib ../bin/yaku.pl -W -a $yakuOpts $programFile && uxncli $romFile`
    } else {
        @res = `perl -I../lib ../bin/yaku.pl $yakuOpts -W -r $programFile`;
    }
    my $res_str='';
    for my $resl (@res) {
        chomp $resl;
        $resl=~s/^\s+//msg;
        # say "<$resl>";
        $res_str.=$resl;
    }
    my $test_outcome = ($ref_str eq $res_str) ? 'PASS' : 'FAIL';
    if ($test_outcome eq 'PASS') {
        $n_passes++;
    } else {
        $n_fails++;
    }
    do {print $programFile, "\t";
    say "<$ref_str> <$res_str> :",$test_outcome; } unless ($failOnly and $test_outcome eq 'PASS');
    die if $quit and $test_outcome eq 'FAIL';

}
    say "Total tests run: $n_tests_run; PASS: $n_passes; FAIL: $n_fails; passrate: ",int(100*$n_passes/$n_tests_run).'%';

