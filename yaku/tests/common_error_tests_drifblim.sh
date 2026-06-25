#!/bin/bash

as="$HOME/.local/bin/uxncli $HOME/Git/drifblim/bin/drifloon.rom"

echo -n "1.1."
echo "|0100 test BRK @test #002a #002a STA2 JMP2r" | $as > tmp.rom
echo "1.1. Stack constant followed by load or store"

echo -n "1.2."
echo "|0100 test BRK @test #002a 002a STA2 JMP2r" | $as > tmp.rom 
echo "1.2. Raw constant followed by load or store"

echo -n "2.1."
echo "|0100 test BRK @test #002b ,x STA2 JMP2r @x \$2" | $as > tmp.rom
echo "2.1. LD/ST address with incompatible reference mode"

echo -n "2.2."
echo "|0100 test BRK @test #2a ;&z STR JMP2r &z \$1" | $as > tmp.rom
echo "2.2. LD/ST address with incompatible reference mode"

echo -n "2.3."
echo "|0000 @z \$1 |0100 test BRK @test #2a .z STA JMP2r" | $as > tmp.rom
echo "2.3. LD/ST address with incompatible reference mode"

echo -n "2.4."
echo "|0000 |0100 test BRK @test #2a ;z STZ JMP2r @z \$1" | $as > tmp.rom
echo "2.4. LD/ST address with incompatible reference mode"

echo -n "2.5."
echo "|0000 @z \$1 |0100 test BRK @test #2a ;z STZ JMP2r" | $as > tmp.rom
echo "2.5. LD/ST address with incompatible reference mode"

echo -n "3.1."
echo "|0100 test BRK @test #2a ;&z STA JMP2r &z &x" | $as > tmp.rom
echo "3.1. No allocation for reference"

echo -n "3.2."
echo "|0000 @z |0100 test BRK @test #2a .z STZ JMP2r" | $as > tmp.rom
echo "3.2. No allocation for reference"

echo -n "4.1."
echo "|0100 test BRK @test #002a ;&z STA2 JMP2r &z \$1" | $as > tmp.rom
echo "4.1. Allocation is only a byte, access is a short"

echo -n "4.2."
echo "|0000 @z \$1 |0100 test BRK @test #002a .z STZ2 JMP2r" | $as > tmp.rom
echo "4.2. Allocation is only a byte, access is a short"

echo -n "5.1."
echo "|0100 test BRK @test #2a ;&z STA JMP2r &z \$2" | $as > tmp.rom
echo "5.1. Allocation is larger than access size"

echo -n "5.2."
echo "|0000 @z \$2 |0100 test BRK @test #2a .z STZ JMP2r" | $as > tmp.rom
echo "5.2. Allocation is larger than access size"

echo -n "6.1."
echo "|0100 test BRK @test #002a ;&z STA JMP2r &z \$1" | $as > tmp.rom
echo "6.1. Allocation size different from size of constant to be stored"

echo -n "6.2."
echo "|0000 @z \$1 |0100 test BRK @test #002a .z STZ JMP2r" | $as > tmp.rom
echo "6.2. Allocation size different from size of constant to be stored"

echo -n "7.1."
echo "|0100 test BRK @test #2a ;&z STA2 JMP2r &z \$2 &x \$2" | $as > tmp.rom
echo "7.1. Store size different from size of constant to be stored"

echo -n "7.2."
echo "|0000 @z \$1 @x \$1 |0100 test BRK @test #002a .z STZ JMP2r" | $as > tmp.rom
echo "7.2. Store size different from size of constant to be stored"

echo -n "8.1."
echo "|0100 test BRK @test #01 ,&end JCN2 &end JMP2r" | $as > tmp.rom
echo "8.1. Jump has address with incompatible reference mode"

echo -n "8.2."
echo "|0100 test BRK @test #01 ;&end JCN &end JMP2r" | $as > tmp.rom
echo "8.2. Jump has address with incompatible reference mode"

echo -n "9.1."
echo "|0100 test BRK @test #0001 #0001 SFT2 JMP2r" | $as > tmp.rom
echo "9.1. Second argument of SFT must be a byte"

echo -n "9.3. "
echo "|0100 test BRK @test #01 #10 SFT2 JMP2r" | $as > tmp.rom
echo "9.3. Error: SFT short mode not compatible with size of first argument"

echo -n "9.4. "
echo "|0100 test BRK @test #0101 #01 SFT JMP2r" | $as > tmp.rom
echo "9.4. Error: SFT short mode not compatible with size of first argument"

echo -n "9.5. "
echo "|0100 test BRK @test ,&x LDR #10 SFT2 JMP2r &x 11" | $as > tmp.rom
echo "9.5. Error: SFT short mode not compatible with size of first argument"

echo -n "9.6. "
echo "|0100 test BRK @test ,&x LDR2 #01 SFT JMP2r &x 1111" | $as > tmp.rom
echo "9.6. Error: SFT short mode not compatible with size of first argument"
