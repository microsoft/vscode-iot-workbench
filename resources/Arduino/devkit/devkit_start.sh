#!/bin/bash
# If you change this file, please manually run `docker image rm ${imageName}` to delete the original image.
# So next time the "compile" command will build a new image according to your change.

AZ3166_version=1.6.2

# Install AZ3166 package
arduino-cli core list | grep -q AZ3166
az3166_installed=$?
if [ $az3166_installed != 0 ]; then
    echo "## AZ3166 has not been installed. Installing AZ3166..."
    
    echo "## Update core index..."
    arduino-cli core update-index

    echo "## Install AZ3166 package"
    arduino-cli core install AZ3166:stm32f4@${AZ3166_version}

    arduino-cli core list
fi

# Re-build application
if [[ $1 == "compile" ]]; then
    echo "######## Compiling the application..."
    if [[ -f /work/device/device.ino ]]; then
        arduino-cli compile --fqbn AZ3166:stm32f4:MXCHIP_AZ3166 /work/device --debug
        ls -al /work/device/
    else 
        echo "device.ino does not exist."
    fi
elif [[ $# != 0 ]]; then
    # If have arguments, interact with arduino-cli
    echo "Command: arduino-cli $@"
    arduino-cli $@
fi
