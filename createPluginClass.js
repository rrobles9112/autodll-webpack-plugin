// const { promisifyAll } = require('bluebird');

const log = require('./utils/log');
const { buildIfNeeded } = require('./cache');
const createCompiler = require('./createCompiler');
const { getManifests, getBundles, cacheDir } = require('./paths');
const webpack = require('webpack');
const { concat, readFile, merge } = require('./utils');
const path = require('path');
const chalk = require('chalk');

const createMemory = require('./createMemory');

class Plugin {
  constructor(options) {
    this.options = options;
  }

  onRun (compiler, callback) {
    const { entry } = this.options;
    return buildIfNeeded(entry, () => createCompiler({ entry }))
      .then(() => {
        log('initialized!');
        return createMemory().then((memory) => {
          this.initialized = true;
          this.memory = memory;
        });
      })    
      .then(log('dll created!'))
      .then(() => callback());
  }

  apply(compiler) {
    const { context, inject, entry } = this.options;

    getManifests(entry).forEach(manifestPath => {
      const instance = new webpack.DllReferencePlugin({
        context: context,
        manifest: manifestPath
      });

      instance.apply(compiler);
    });

    compiler.plugin('before-compile', (params, callback) => {
      params.compilationDependencies = params.compilationDependencies
        .filter((path) => !path.startsWith(cacheDir));
        
      callback();
    });

    compiler.plugin('run', this.onRun.bind(this));
    compiler.plugin('watch-run', this.onRun.bind(this));

    compiler.plugin('emit', (compilation, callback) => {
      const { memory } = this;

      const assets = memory.getBundles()
        .map(({ filename, buffer }) => {
          return {
            [`dll/${filename}`]: {
              source: () => buffer.toString(),
              size: () => buffer.length
            }
          };
        });

      compilation.assets = merge(compilation.assets, ...assets);
      callback();
    });

    if (inject) {
      compiler.plugin('compilation', compilation => {
        compilation.plugin(
          'html-webpack-plugin-before-html-generation',
          (htmlPluginData, callback) => {
            const { memory } = this;
            const bundlesPublicPaths = memory.getBundles().map(({ filename }) => `dll/${filename}`);

            log('injecting scripts to', htmlPluginData.outputName);
            
            bundlesPublicPaths.forEach((bundleName) => {
              log('injecting', bundleName);
            });

            htmlPluginData.assets.js = concat(
              bundlesPublicPaths,
              htmlPluginData.assets.js
            );

            callback();
          }
        );
      });
    }
  }
}

module.exports = Plugin;
