#Copyright (c) Microsoft. All rights reserved.
#Licensed under the MIT license. See LICENSE file in the project root for full license information.

#this is CMakeLists.txt for {PROJECT_NAME}

#Compile As C99
if (CMAKE_VERSION VERSION_LESS "3.1")
    if (CMAKE_C_COMPILER_ID STREQUAL "GNU" OR CMAKE_C_COMPILER_ID STREQUAL "Clang")
        set (CMAKE_C_FLAGS "--std=c99 /DWIN32 /D_WINDOWS /W3")
        if (NOT IN_OPENWRT)
            set (CMAKE_CXX_FLAGS "--std=c++11 /DWIN32 /D_WINDOWS /W3 /GR /EHsc")
        endif()
    endif()
else()
    set (CMAKE_C_STANDARD 99)
    set (CMAKE_CXX_STANDARD 11)
endif()

cmake_minimum_required(VERSION 2.8)

set({PROJECT_NAME}_h_files
    {H_FILE_LIST}
)

set({PROJECT_NAME}_c_files
    {C_FILE_LIST}
    ./main.c
)

include_directories(.)
include_directories(./utilities)
include_directories(${PROJECT_SOURCE_DIR}/deps/parson)
include_directories(${SHARED_UTIL_INC_FOLDER})
include_directories(${IOTHUB_CLIENT_INC_FOLDER})
include_directories(${DIGITALTWIN_CLIENT_INC_FOLDER})
include_directories(${DEV_AUTH_MODULES_CLIENT_INC_FOLDER})

add_executable({PROJECT_NAME} ${{PROJECT_NAME}_c_files} ${{PROJECT_NAME}_h_files})

target_link_libraries({PROJECT_NAME} parson iothub_client_mqtt_transport iothub_client digitaltwin_client prov_device_ll_client prov_mqtt_transport)