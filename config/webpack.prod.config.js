'use strict'

const webpack = require('webpack')

module.exports = {
  output: {
    filename: 'app.[hash].js'
  },
  devtool: '#cheap-module-source-map',
  plugins: [
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      mangle: true,
      compress: {
        warnings: false
      }
    }),
    new webpack.DefinePlugin({
      __SERVER__: false,
      __DEVELOPMENT__: false,
      __DEVTOOLS__: false
    })
  ]
}
