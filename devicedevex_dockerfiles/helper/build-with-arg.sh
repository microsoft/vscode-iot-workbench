#!/bin/bash
set -x

if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <config file path> <dockerfile path>"
    exit 1
fi

configFile=$1
dockerfile_path=$2
image_name=`jq -r .image_name $configFile`

keys=`jq -r '.arg | keys | .[]' $configFile`
build_arg=`jq -r .arg $configFile`

for k in $keys
do
    value=`jq -r .$k <<< $build_arg`
    argJson+=" --build-arg ${k}=${value}"
done
docker build -t $image_name $dockerfile_path $argJson
