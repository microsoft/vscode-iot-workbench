#!/bin/bash
set -x

if [[ $# == 0 ]]; then
    echo "Usage: $0 <srcFileFolder>"
    exit 1
else
    srcFileFolder=$1
    iot_application_code_path="/work/azure-iot-sdk-c/iot_application"
    if [[ ! -d "${iot_application_code_path}" ]]; then
      mkdir ${iot_application_code_path}
    fi
    cp -rf ${srcFileFolder}/* ${iot_application_code_path}
fi

# Configure CMakeLists.txt on first compilation time
iot_application_cmake_path="/work/azure-iot-sdk-c/cmake/iot_application"
if [[ ! -d "${iot_application_cmake_path}" ]]; then
  echo "add_subdirectory(iot_application)" >> /work/azure-iot-sdk-c/CMakeLists.txt
fi

# Compile device code with azure-c-sdk
cd /work/azure-iot-sdk-c/cmake && \
  cmake -DCMAKE_TOOLCHAIN_FILE=${CMAKE_TOOLCHAIN_FILE} -DCMAKE_INSTALL_PREFIX=${LIBC_PREFIX}/usr -Dhsm_type_symm_key:BOOL=ON -Duse_amqp:BOOL=OFF -Dbuild_service_client:BOOL=OFF .. && \
  cmake --build .
