#!/bin/bash
# set -x

# By default install latest AZ3166 version: 1.6.2 
AZ3166_version=1.6.2

install_AZ3166() {
    # Check arduino-cli 
    arduino-cli -h
    if [[ $? != 0 ]]; then
        echo "## ERROR: arduino-cli is not correctly installed."
        exit 0
    fi

    if [[ $# == 0 ]]; then
        version=1.6.2
    else
        version=$1
    fi

    # Install AZ3166 package
    arduino-cli core list | grep -q AZ3166
    if [ $? != 0 ]; then
        echo "## AZ3166 has not been installed. Installing AZ3166..."
        
        echo "## arduino-cli config"
        arduino-cli config dump

        echo "## Update core index..."
        arduino-cli core update-index

        echo "## Install AZ3166 package"
        arduino-cli core install AZ3166:stm32f4@${version} --debug

        arduino-cli core list
    fi
}


if [[ $# == 0 ]]; then
    echo "## No argument is provided to the script."
    echo "Usage: $0 <AZ3166_version>"
else
    AZ3166_version=$1
    echo "## AZ3166 package version: ${AZ3166_version}"
    install_AZ3166 ${AZ3166_version}
fi
