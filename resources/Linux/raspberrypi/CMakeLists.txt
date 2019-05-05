cmake_minimum_required(VERSION 2.8.11)
project(azure_sample_project)

# The demonstration uses C99 but it could just as easily be a C++ application
set(CMAKE_C_FLAGS "--std=c99 ${CMAKE_C_FLAGS}")

set(iothub_c_files
        iothub_convenience_sample.c
)

# Set up the include and library paths
include_directories(.)
include_directories(../deps/parson)
include_directories(${SHARED_UTIL_INC_FOLDER})
include_directories(${IOTHUB_CLIENT_INC_FOLDER})

add_executable(azure_exe ${iothub_c_files})

# List the libraries required by the link step
target_link_libraries(azure_exe iothub_client)