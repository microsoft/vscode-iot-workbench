#!/bin/bash
set -x

application_name="iot_application"
azure_c_sdk_directory="/work/azure-iot-sdk-c"
cmake_directory="${azure_c_sdk_directory}/cmake"
CMakeLists_file_path="${azure_c_sdk_directory}/CMakeLists.txt"
CMakeLists_default_file_path="${azure_c_sdk_directory}/default_CMakeLists.txt"
current_dir=`dirname $(readlink -f $0)`
output_folder="${current_dir}/.build"

if [[ $# == 0 ]]; then
  echo "Usage: $0 <srcFileFolder> [application name]"
  echo "default application name ${application_name}"
  exit 1
elif [[ $# -ge 2 ]]; then
  application_name=$2
fi

srcFileFolder=$1
application_code_path="${azure_c_sdk_directory}/${application_name}"
application_cmake_path="${cmake_directory}/${application_name}"

# Copy code to azure-c-sdk directory
rm -rf ${application_code_path} && mkdir ${application_code_path}
cp -rf ${srcFileFolder}/* ${application_code_path}

# Refresh and configure CMakeLists.txt file
cp ${CMakeLists_default_file_path} ${CMakeLists_file_path}
echo "add_subdirectory(${application_name})" >> ${CMakeLists_file_path}

# Compile device code with azure-c-sdk
cd ${cmake_directory} && \
  cmake -DCMAKE_TOOLCHAIN_FILE=${CMAKE_TOOLCHAIN_FILE} -DCMAKE_INSTALL_PREFIX=${QEMU_LD_PREFIX}/usr .. -Duse_prov_client=ON -Dhsm_type_symm_key:BOOL=ON && \
  cmake --build .

# Clean old binary file
current_binary_name=`cat ${cmake_directory}/CMakeCache.txt | grep binary_name | cut -d "=" -f2`
cd ${application_cmake_path} && find . -type f -executable -not -name "${current_binary_name}" | xargs -r rm

# Copy the compiled files to output folder
rm -rf ${output_folder} && mkdir ${output_folder}
if [[ -d "${application_cmake_path}" ]]; then
  cp -r ${application_cmake_path}/* ${output_folder}
fi
