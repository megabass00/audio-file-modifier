const getParam = (param, defaultVal = '') => {
  let paramValue = defaultVal;
  param += '=';
  process.argv.forEach(val => {
    if (val.indexOf(param) > -1) paramValue = val.substring(param.length);
  });
  return paramValue;
};

const checkOption = (param, defaultVal = false) => {
  let paramValue = defaultVal;
  process.argv.forEach(val => {
    if (val.indexOf(param) > -1) paramValue = true;
  });
  return paramValue;
};

const AudioFileNormalize = require('./AudioFileNormalize');

// const minRate = parseInt(getParam('rate', 320));
// const minSimilarity = parseInt(getParam('similarity', 80)) / 100;
// const engine = getParam('engine', 'myfreemp3');
// const proxyAddress = getParam('proxy', false);
// const noWindow = checkOption('no-window', false);
// const minimizeWindow = checkOption('minimize', false);
// const alwaysDownloadFiles = checkOption('alwaysDownloadFiles', true);

const normalizer = new AudioFileNormalize();
const args = process.argv.slice(2);

switch (args[0]) {
  case 'normalize':
    // if (!args[1]) {
    //   normalizer.log('Error:'.bgRed, 'You must enter a valid local path file'.red);
    //   return;
    // }
    normalizer.normalizeFile(args[1]);
    break;

  // case 'song':
  //   if (!args[1]) {
  //     normalizer.log('Error:'.bgRed, 'You must enter a song title wrapped between quotes'.red);
  //     return;
  //   }
  //   normalizer.dowmloadSong(args[1]);
  //   break;

  // case 'export':
  //   if (!args[1]) {
  //     normalizer.log('Error:'.bgRed, 'You must enter a valid playlist ID for export'.red);
  //     return;
  //   }
  //   normalizer.exportPlaylist(args[1]);
  //   break;

  // case 'download':
  //   if (!args[1]) {
  //     normalizer.log('Error:'.bgRed, 'You must enter a valid file path'.red);
  //     return;
  //   }
  //   normalizer.importAndDownloadFile(args[1]);
  //   break;

  default:
    downloader.log('Error'.bgRed, 'Sorry, enter a valid operation'.red);
    downloader.log('Valid operations:'.yellow, '(playlist | song | export | download)'.cyan);
}
