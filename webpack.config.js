/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

"use strict";

const failOnErrorsPlugin = require("fail-on-errors-webpack-plugin");
const path = require("path");
const webpack = require("webpack");

/**@type {import('webpack').Configuration}*/
const config = {
  target: "node", // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  entry: "./src/extension.ts", // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]"
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode",
    keytar: "commonjs keytar",
    getmac: "commonjs getmac",
    getos: "commonjs getos",
    "usb-detection": "commonjs usb-detection",
    eventemitter2: "commonjs eventemitter2",
    bindings: "commonjs bindings",
    "file-uri-to-path": "commonjs file-uri-to-path",
    "@serialport/bindings": "commonjs @serialport/bindings",
    "@serialport/binding-abstract": "commonjs @serialport/binding-abstract",
    "@serialport/parser-readline": "commonjs @serialport/parser-readline",
    "@serialport/parser-delimiter": "commonjs @serialport/parser-delimiter",
    debug: "commonjs debug",
    ms: "commonjs ms"
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: [".ts", ".js", ".json", ".node"]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: "ts-loader"
      },
      {
        test: /\.node$/,
        use: "node-loader"
      }
    ]
  },
  node: {
    __dirname: false,
    __filename: true
  },
  plugins: [
    // Ignore all locale files of moment.js, which can save 50KB
    // https://webpack.js.org/plugins/ignore-plugin/#ignore-moment-locales
    new webpack.IgnorePlugin(/^\.\/locale$/, /[\/\\]moment$/),
    // The following modules are missing after "npm install", probably due to the bugs in modules that requires them
    new webpack.IgnorePlugin(/applicationinsights-native-metrics/),
    new webpack.IgnorePlugin(/original-fs/),
    new webpack.IgnorePlugin(/utf-8-validate/),
    new webpack.IgnorePlugin(/bufferutil/),
    // Suppress warnings of known dynamic require
    new webpack.ContextReplacementPlugin(/applicationinsights[\/\\]out[\/\\]Library/, false, /$^/),
    new webpack.ContextReplacementPlugin(/ms-rest[\/\\]lib/, false, /$^/),
    new webpack.ContextReplacementPlugin(/applicationinsights[\/\\]out[\/\\]AutoCollection/, false, /$^/),
    new webpack.ContextReplacementPlugin(/express[\/\\]lib/, false, /$^/),
    // Fail on warnings so that CI can report new warnings which requires attention
    new failOnErrorsPlugin({
      failOnErrors: true,
      failOnWarnings: false
    })
  ]
};

module.exports = config;
