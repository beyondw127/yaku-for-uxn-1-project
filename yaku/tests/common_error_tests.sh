#!/bin/bash

as="perl -I../lib ../bin/yaku.pl -i "

echo -n "1.1. "
echo "|0100 test BRK @test #002a #002a STA2 JMP2r" | $as 
echo "1.1. Error: Stack constant followed by load or store"

echo -n "1.2. "
echo "|0100 test BRK @test #002a 002a STA2 JMP2r" | $as 
echo "1.2. Error: Raw constant followed by load or store"

echo -n "1.3. "
echo "|0000 @x abcd |0100 BRK" | $as
echo "1.3. Writing raw values in the zero page is not allowed"

echo -n "1.4. "
echo "|0000 @x \"Hello! |0100 BRK" | $as
echo "1.4. Writing raw values in the zero page is not allowed"

echo -n "2.1. "
echo "|0100 test BRK @test #002b ,x STA2 JMP2r @x \$2" | $as
echo "2.1. Error: LD/ST address with incompatible reference mode"

echo -n "2.2. "
echo "|0100 test BRK @test #2a ;&z STR JMP2r &z \$1" | $as
echo "2.2. Error: LD/ST address with incompatible reference mode"

echo -n "2.3. "
echo "|0000 @z \$1 |0100 test BRK @test #2a .z STA JMP2r" | $as
echo "2.3. Error: LD/ST address with incompatible reference mode"

echo -n "2.4. "
echo "|0000 |0100 test BRK @test #2a ;z STZ JMP2r @z \$1" | $as
echo "2.4. Error: LD/ST address with incompatible reference mode"

echo -n "2.5. "
echo "|0000 @z \$1 |0100 test BRK @test #2a ;z STZ JMP2r" | $as
echo "2.5. Error: LD/ST address with incompatible reference mode"

echo -n "3.1. "
echo "|0100 test BRK @test #2a ;&z STA JMP2r &z &x" | $as
echo "3.1. Error: No allocation for reference"

echo -n "3.2. "
echo "|0000 @z |0100 test BRK @test #2a .z STZ JMP2r" | $as
echo "3.2. Error: No allocation for reference"

echo -n "4.1. "
echo "|0100 test BRK @test #002a ;&z STA2 JMP2r &z \$1" | $as
echo "4.1. Error: Allocation is only a byte, access is a short"

echo -n "4.2. "
echo "|0000 @z \$1 |0100 test BRK @test #002a .z STZ2 JMP2r" | $as
echo "4.2. Error: Allocation is only a byte, access is a short"

echo -n "5.1. "
echo "|0100 test BRK @test #2a ;&z STA JMP2r &z \$2" | $as
echo "5.1. Warning: Allocation is larger than access size"

echo -n "5.2. "
echo "|0000 @z \$2 |0100 test BRK @test #2a .z STZ JMP2r" | $as
echo "5.2. Warning: Allocation is larger than access size"

echo -n "6.1. "
echo "|0100 test BRK @test #002a ;&z STA JMP2r &z \$1" | $as
echo "6.1. Warning: Allocation size different from size of constant to be stored"

echo -n "6.2. "
echo "|0000 @z \$1 |0100 test BRK @test #002a .z STZ JMP2r" | $as
echo "6.2. Warning: Allocation size different from size of constant to be stored"

echo -n "7.1. "
echo "|0100 test BRK @test #2a ;&z STA2 JMP2r &z \$2 &x \$2" | $as
echo "7.1. Warning: Store size different from size of constant to be stored"

echo -n "7.2. "
echo "|0000 @z \$1 @x \$1 |0100 test BRK @test #002a .z STZ JMP2r" | $as
echo "7.2. Warning: Store size different from size of constant to be stored"

echo -n "8.1. "
echo "|0100 test BRK @test #01 ,&end JCN2 &end JMP2r" | $as
echo "8.1. Error: Jump has address with incompatible reference mode"

echo -n "8.2. "
echo "|0100 test BRK @test #01 ;&end JCN &end JMP2r" | $as
echo "8.2. Error: Jump has address with incompatible reference mode"

echo -n "9.1. "
echo "|0100 test BRK @test #0001 #0001 SFT2 JMP2r" | $as
echo "9.1. Error: Second argument of SFT must be a byte"

echo -n "9.2. "
echo "|0100 test BRK @test #01 #0001 SFT JMP2r" | $as
echo "9.2. Error: Second argument of SFT must be a byte"

echo -n "9.3. "
echo "|0100 test BRK @test #01 #10 SFT2 JMP2r" | $as
echo "9.3. Error: SFT short mode not compatible with size of first argument"

echo -n "9.4. "
echo "|0100 test BRK @test #0101 #01 SFT JMP2r" | $as
echo "9.4. Error: SFT short mode not compatible with size of first argument"

echo -n "9.5. "
echo "|0100 test BRK @test ,&x LDR #10 SFT2 JMP2r &x 11" | $as
echo "9.5. Error: SFT short mode not compatible with size of first argument"

echo -n "9.6. "
echo "|0100 test BRK @test ,&x LDR2 #01 SFT JMP2r &x 1111" | $as
echo "9.6. Error: SFT short mode not compatible with size of first argument"
