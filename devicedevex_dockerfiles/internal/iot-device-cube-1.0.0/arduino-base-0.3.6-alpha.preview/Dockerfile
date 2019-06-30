# devicedevex.azurecr.io/internal/iot-device-cube:1.0.0-arduino-base-0.3.6-alpha.preview
FROM ubuntu:18.04

ARG arduino_cli_url=https://github.com/arduino/arduino-cli/releases/download/0.3.6-alpha.preview/arduino-cli-0.3.6-alpha.preview-linux64.tar.bz2
ARG go_url=https://dl.google.com/go/go1.12.1.linux-amd64.tar.gz

RUN mkdir /work
WORKDIR /work

# Install arduino-cli and go compiler
RUN apt-get update && \
	apt-get install -y --no-install-recommends ca-certificates wget git unzip && \
	wget ${arduino_cli_url} && \
	tar -jxvf arduino-cli-* && \
	rm -r arduino-cli-*.tar.bz2 && \
	mv arduino-cli-* arduino-cli && \
	mv arduino-cli /usr/bin && \
	wget ${go_url} && \
	tar -C /usr/local -xzf go*.tar.gz && \	
	rm go*.tar.gz && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV PATH=$PATH:/usr/local/go/bin

# Download arduino-cli sdk
RUN go get -u github.com/arduino/arduino-cli