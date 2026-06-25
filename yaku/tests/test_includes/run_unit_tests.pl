#!/usr/bin/env perl
use warnings;
use strict;
use v5.30;
use Data::Dumper;

my $tal_file = $ARGV[0];
if (-e 'tmp.rom') {unlink 'tmp.rom';}
my $asm_log = `uxnasm $tal_file tmp.rom`;
if (-e 'tmp.rom') { 
    if (-e 'tmp.log') {unlink 'tmp.log';}
    system("uxncli tmp.rom > tmp.log");
} else {
    say "Assembly of $tal_file failed: $asm_log";
}

my @tests=(
          'Test_for_clear_bit(idx)',
          'Test_for_set_bit(idx)',
          'Test_for_alloc_sz_is_free_at_idx(idx,alloc_sz)',
          'Test_for_mask_set(bit_idx)',
          'Test_for_free_alloc_sz_at_idx(idx,alloc_sz)',
          'Test_for_claim_alloc_sz_at_idx(idx,alloc_sz)',
          'Test_for_mask_clear(bit_idx)',
          'Test_for_get_bit(idx)'
);

my %reference = (
          'Test_for_clear_bit(idx)' => [
                                         '0 0',
                                         '0 0',
                                         '0 0',
                                         '0 0',
                                         '0 0',
                                         '0 0'
                                       ],
          'Test_for_set_bit(idx)' => [
                                       '1 1',
                                       '1 1',
                                       '1 1',
                                       '1 1',
                                       '1 1',
                                       '1 1'
                                     ],
          'Test_for_alloc_sz_is_free_at_idx(idx,alloc_sz)' => [
                                                                'part1',
                                                                '0',
                                                                '0',
                                                                '0',
                                                                '0',
                                                                '0',
                                                                'part2',
                                                                '1',
                                                                '1',
                                                                '1',
                                                                '1',
                                                                '0',
                                                                'part3',
                                                                '1',
                                                                '1',
                                                                '1',
                                                                '0',
                                                                '0',
                                                                'part4',
                                                                '1',
                                                                '1',
                                                                '1',
                                                                '1',
                                                                '1'
                                                              ],
          'Test_for_mask_set(bit_idx)' => [
                                            '1',
                                            '1',
                                            '1',
                                            '1',
                                            '1',
                                            '1',
                                            '1',
                                            '1'
                                          ],
          'Test_for_free_alloc_sz_at_idx(idx,alloc_sz)' => [
                                                             '1',
                                                             '1'
                                                           ],
          'Test_for_claim_alloc_sz_at_idx(idx,alloc_sz)' => [
                                                              'part1',
                                                              '80 1',
                                                              'e0 1',
                                                              'fc 1',
                                                              'ff c0 1',
                                                              'ff fe 1',
                                                              'part2',
                                                              '1',
                                                              '0'
                                                            ],
          'Test_for_mask_clear(bit_idx)' => [
                                              '1',
                                              '1',
                                              '1',
                                              '1',
                                              '1',
                                              '1',
                                              '1',
                                              '1'
                                            ],
          'Test_for_get_bit(idx)' => [
                                       '1 0',
                                       '1 0',
                                       '1 0',
                                       '1 0',
                                       '1 0',
                                       '1 0',
                                       '1 1',
                                       '1 1',
                                       '1 0',
                                       '1 1',
                                       '1 0',
                                       '1 1'
                                     ]
    );


my %results = load_log('tmp.log');

my @out_all=();
for my $test (@tests) {
    # say $test;
    if (exists $results{$test}) {
        my @out=();
        for my $reference (@{$reference{$test}}) {
                my $result = shift @{$results{$test}};
                if ($reference ne $result) {
                    push @out, "$result <> $reference";
                };
        }
        if (@out) {
            unshift @out, $test;
        } else {
            @out_all = (@out_all,@out);
        }
        # say Dumper($reference{$test});
    } else {
        push @out_all, "No result for test $test";
    }
    # say Dumper($results{$test});

}
print  "$tal_file ";
if (@out_all){
    say "failed some tests: ";
    map {say $_} @out_all;
} else {
    say "passed all tests";
}

sub load_log { my ($log) = @_;
    open my $LOG, '<', $log or die $!;
    my %tests = ();
    my $current_tst='';
    while (my $line=<$LOG>) {
        chomp $line;
        next if $line=~/^\s*$/;
        if ($line=~/Test/)  {
            $current_tst = $line;
            $current_tst =~s/\s/_/g;
            $tests{$current_tst}=[];
        } else {
            push @{ $tests{$current_tst} },$line;
        }
    }
    close $LOG;
    return %tests;
}