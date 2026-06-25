#!/bin/sh

as="perl -I./lib ./bin/yaku.pl -i "

echo "" && echo "@Scope" | $as 
echo "Assembled in 0 bytes."

echo "" && echo "Token ----------------------------------------------"

echo "" && echo "@scope ; @end" | $as 
echo "Token invalid: ; in scope"

echo "" && echo "@scope . @end" | $as 
echo "Token invalid: . in scope"

echo "" && echo "@scope , @end" | $as 
echo "Token invalid: , in scope"

echo "" && echo "@scope LIT2 = @end" | $as 
echo "Token invalid: = in scope"

echo "" && echo "@scope LIT - @end" | $as 
echo "Token invalid: - in scope"

echo "" && echo "@scope LIT _ @end" | $as 
echo "Token invalid: _ in scope"

echo "" && echo "@scope | @end" | $as 
echo "Token invalid: | in scope"

echo "" && echo "@scope $ @end" | $as 
echo "Token invalid: $ in scope"

echo "" && echo "@scope \" @end" | $as 
echo "Token invalid: \" in scope"

echo "" && echo "@scope ! @end" | $as 
echo "Token invalid: ! in scope"

echo "" && echo "@scope ? @end" | $as 
echo "Token invalid: ? in scope"

echo "" && echo "@scope # @end" | $as 
echo "Token invalid: # in scope"

echo "" && echo "Comment --------------------------------------------"

echo "" && echo "@scope ( BRK @end" | $as 
echo "Comment open: .. in scope"

echo "" && echo "@scope #01 (BRK ) @end" | $as 
echo "Comment invalid: (BRK in scope"

echo "" && echo "Writing --------------------------------------------"

echo "" && echo "@scope |80 #1234 @end" | $as 
echo "Writing in zero-page: #1234 in scope"

echo "" && echo "Symbol ---------------------------------------------"

echo "" && echo "@scope @foo @foo @end" | $as 
echo "Symbol duplicate: foo"

echo "" && echo "@scope @1234 @end" | $as 
echo "Symbol invalid: 1234"

echo "" && echo "@scope @LDA @end" | $as 
echo "Symbol invalid: LDA"

echo "" && echo "%label { SUB } @label" | $as 
echo "Symbol duplicate: @label"

echo "" && echo "@scope &foo &foo @end" | $as 
echo "Symbol duplicate: foo in scope"

echo "" && echo "Opcode ---------------------------------------------"

echo "" && echo "@scope ADD2q @end" | $as 
echo "Opcode invalid: ADD2q in scope"

echo "" && echo "Number ---------------------------------------------"

echo "" && echo "@scope 2 @end" | $as 
echo "Number invalid: 2 in scope"

echo "" && echo "@scope 123 @end" | $as 
echo "Number invalid: 123 in scope"

echo "" && echo "@scope 12345 @end" | $as 
echo "Number invalid: 12345 in scope"

echo "" && echo "@scope #1g @end" | $as 
echo "Number invalid: #1g in scope"

echo "" && echo "@scope #123g @end" | $as 
echo "Number invalid: #123g in scope"

echo "" && echo "Macros ---------------------------------------------"

echo "" && echo "@scope %label { ADD } %label { SUB }" | $as 
echo "Macro duplicate: %label in scope"

echo "" && echo "@scope %label #1234" | $as 
echo "Macro open: .. in scope"

echo "" && echo "@scope %test { BRK @end" | $as 
echo "Macro open: .. in scope"

echo "" && echo "@scope %macro {BRK } #1234" | $as 
echo "Macro open: .. in scope"

echo "" && echo "@scope %macro { BRK} #1234" | $as 
echo "Macro open: .. in scope"

echo "" && echo "References -----------------------------------------"

echo "" && echo "@scope LIT2 =label @end" | $as 
echo "Reference invalid: label in scope"

echo "" && echo "@scope ;label @end" | $as 
echo "Reference invalid: label in scope"

echo "" && echo "@scope .label @end" | $as 
echo "Reference invalid: label in scope"

echo "" && echo "@scope ,label @end" | $as 
echo "Reference invalid: label in scope"

echo "" && echo "@scope LIT _label @end" | $as 
echo "Reference invalid: label in scope"

echo "" && echo "@scope ,next \$81 @next @end" | $as 
echo "Reference too far: next in scope"

echo "" && echo "@back \$7e @scope ,back @end" | $as 
echo "Reference too far: back in scope"

