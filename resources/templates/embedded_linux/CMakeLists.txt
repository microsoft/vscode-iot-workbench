cmake_minimum_required(VERSION 2.8.11)

# The demonstration uses C99 but it could just as easily be a C++ application
set(CMAKE_C_FLAGS "--std=c99 ${CMAKE_C_FLAGS}")

set(iothub_c_files
        main.c
)

# Set up the include and library paths
include_directories(.)

add_executable(${binary_name} ${iothub_c_files})

# Find azure_iot_sdks Vcpkg package
find_package(azure_iot_sdks REQUIRED)
find_package(ZLIB REQUIRED)
find_package(OpenSSL REQUIRED)
find_library(CURL NAMES curl-d curl)

# List the libraries required by the link step
target_link_libraries(${binary_name}
parson
iothub_client_mqtt_transport
iothub_client
digitaltwin_client
prov_auth_client
aziotsharedutil
umqtt
uuid
${CURL}
pthread
ssl
crypto
m
ZLIB::ZLIB
)