#Copyright (c) Microsoft. All rights reserved.
#Licensed under the MIT license. See LICENSE file in the project root for full license information.

#this is CMakeLists.txt for {PROJECT_NAME}

compileAsC99()

cmake_minimum_required(VERSION 2.8)

file(GLOB {PROJECT_NAME}_src
    "*.c"
    "./utilities/*.c"
)

include_directories(.)
include_directories(./utilities)
include_directories(../deps/parson)
include_directories(${SHARED_UTIL_INC_FOLDER})
include_directories(${IOTHUB_CLIENT_INC_FOLDER})
include_directories(${DIGITALTWIN_CLIENT_INC_FOLDER})

add_executable({PROJECT_NAME} ${{PROJECT_NAME}_src})

target_link_libraries({PROJECT_NAME} parson iothub_client digitaltwin_client)