const path = require('path');
const isEqual = require('lodash/isEqual');

const { log, writeFile, readFile, mkdirp } = require('./utils');
const { cacheDir } = require('./paths');
const del = require('del');

const isCacheValid = dllSettings => {
  return mkdirp(cacheDir)
    .then(() => readFile(path.resolve(cacheDir, 'lastDllSettings.json')))
    .then(file => {
      let lastDllSettings = JSON.parse(file);
      return isEqual(lastDllSettings, dllSettings);
    })
    .catch(() => {
      return false;
    });
};

const cleanup = () => del(path.join(cacheDir, '**'));

const storeDllSettings = dllSettings => () => {
  return writeFile(
    path.resolve(cacheDir, 'lastDllSettings.json'),
    JSON.stringify(dllSettings)
  );
};

const buildIfNeeded = (dllSettings, getCompiler) => {
  return isCacheValid(dllSettings)
    .then(log(isValid => 'is valid cache? ' + isValid))
    .then(isValid => {
      if (isValid) return;

      const compile = () => {
        return new Promise((resolve, reject) => {
          getCompiler().run((err) => {
            if (err) { return reject(err); }
            resolve();
          });
        });
      };

      return (
        Promise.resolve()
          .then(log('cleanup'))
          .then(cleanup)
          .then(log('compile'))
          .then(compile)
          .then(log('write lastDllSettings.json'))
          .then(storeDllSettings(dllSettings))
          .catch((err) => {
            console.log(err);
          })
      );
    });
};


module.exports = { buildIfNeeded };