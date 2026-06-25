#!/usr/bin/env perl
#use strict;
use warnings;
use Data::Dumper;
use Carp;

my @lines = ();
while(<>){
    chomp $_;
    push @lines,$_;
}

    for my $line ( @lines ) {        
        # First we replace parens in strings by their ASCII codes
        
        if ($line=~/\"/) { 
            my @chunks = split(/\s+/,$line);
            for my $chunk (@chunks) {
                if($chunk =~ /^\"/) {
                    while ($chunk =~ /\(/) {
                        $chunk =~s/\(/ 28 \"/;
                    } 
                    while ($chunk =~ /\)/) {
                        $chunk =~s/\)/ 29 \"/;
                    }
                    $chunk =~s/\s*\"\s*$//;
                    $chunk =~s/^\s*\"\s*//;
                    #$chunk = "<$chunk>";
                }
            }
            $line = join(' ',@chunks);
        } 
    }
    croak Dumper \@lines;
