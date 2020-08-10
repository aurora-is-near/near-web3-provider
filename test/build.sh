#!/bin/bash

contracts=(
    "ZombieAttack"
)

truffle compile || exit 1
for contractName in "${contracts[@]}"
    do
        cat build/contracts/"$contractName".json | \
          jq .bytecode | \
          awk '{ print substr($1,4,length($1)-4) }' | \
          tr -d '\n' \
          > ./artifacts/"$contractName".bin

        cat build/contracts/"$contractName".json | \
          jq .abi \
          > ./artifacts/"$contractName".abi
    done
rm -rf build
