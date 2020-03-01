#!/usr/bin/env bash

#set -x
LOG=./fulllog # log to audit

patternInFile() {
    # example:./a/b/xxx.png
    PATTERN=$1
    FILE=$2

    RES=`grep $PATTERN ./$FILE`

    if [ -n "$RES" ];then
        return 1 # true 
    else
        return 0  # false 
    fi 
}

shouldIBeDeleted() {
    #IMAGE_PATTERN="$1"
    #MDS_DIR="$2" # suppose mds are under this dir without sub dirs.

    echo "" >> $LOG
    echo "$1 <- " >> $LOG

    CNT=0

    for MD in `ls ./$2 | grep md$`
    do
        MD_FILE=./$2/$MD
        patternInFile "$1" $MD_FILE
        DELTA=$?
        if [ "$DELTA" = "1" ];then
            echo "  $MD_FILE" >> $LOG
        fi
        (( CNT += DELTA ))
    done
    
    if [ "$CNT" = "0" ];then
        # should be deleted.
        # no md files depend on this image.
        return 1 # yes to delete.
    else
        return 0 # not to delete.
    fi
}

DELETE_LIST=./todelete

splitForLast() {
   # Usage: split "string" "delimiter"
   IFS=$'\n' read -d "" -ra arr <<< "$1"
   printf '%s\n' "${arr[@]}"
}

walkDirGenDeleteList() {
    #IMAGE_DIR=$1
    #MD_DIR=$2

    # code refer to: https://github.com/dylanaraps/pure-bash-bible
    shopt -s globstar
    for IMG in ./$1/**/* 
    do
        if [ -f "$IMG" ];then
            # regular file, expect to be of image type.
            # here we got the full path of image: $IMG
            # trim to get last image file name: $FNAME.
            IFS=$'/' read -d "" -ra ARR <<< "$IMG"
            FNAME=${ARR[-2]}/${ARR[-1]}
            shouldIBeDeleted $FNAME $2
            if [ "$?" = "1" ];then
                echo $IMG >> ./$DELETE_LIST # collect files to be deleted.
            fi
        fi
    done
    shopt -u globstar
}

>$LOG
>$DELETE_LIST

walkDirGenDeleteList ../esp32/media ../esp32  
#walkDirGenDeleteList ../iot-devkit/media ../iot-devkit
