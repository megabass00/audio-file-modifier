const getParam = (param, defaultVal = '') => {
  let paramValue = defaultVal;
  param += '=';
  process.argv.forEach(val => {
    if (val.indexOf(param) > -1) paramValue = val.substring(param.length);
  });
  return paramValue;
};

const AudioFileModifier = require('./AudioFileModifier');

const outFile = getParam('outFile', 'example.mp3');
const volume = getParam('volume', 1.0);
const sampleRate = getParam('sampleRate', 44100);
const channels = getParam('channels', 2);
const pitch = getParam('pitch', 120);
const fade = getParam('fade', false);
const fadeIn = getParam('fadeIn', false);
const fadeOut = getParam('fadeOut', false);
const recTime = getParam('recTime', 10);
const verbose = getParam('verbose', false);

const audioModifier = new AudioFileModifier({
  outFile,
  volume,
  sampleRate,
  channels,
  pitch,
  fade,
  fadeIn,
  fadeOut,
  recTime,
  verbose,
});
const args = process.argv.slice(2);

switch (args[0]) {
  case 'normalize':
    if (!args[1]) {
      audioModifier.log('Error:'.bgRed, 'You must enter a valid local path file'.red);
      return;
    }
    audioModifier.normalizeFile(args[1]);
    break;

  case 'volume':
    if (!args[1]) {
      audioModifier.error('Invalid Parameter'.bgRed, 'You must enter a valid local path file'.red);
      return;
    }
    if (!args[2]) {
      audioModifier.error('Invalid Parameter'.bgRed, 'You must enter your output volume wished'.red);
      return;
    }
    audioModifier.changeFileVolume(args[1], args[2]);
    break;

  case 'split':
    if (!args[1]) {
      audioModifier.error('Invalid Parameter'.bgRed, 'You must enter a valid local path file'.red);
      return;
    }
    audioModifier.splitSilences(args[1]);
    break;

  case 'pitch':
    if (!args[1]) {
      audioModifier.error('Invalid Parameter'.bgRed, 'You must enter a valid local path file'.red);
      return;
    }
    if (!args[2]) {
      audioModifier.error('Invalid Parameter'.bgRed, 'You must enter wished pitch percent to change'.red);
      return;
    }
    if (parseInt(args[2]) < 1 || parseInt(args[2]) > 200) {
      audioModifier.error('Invalid Parameter'.bgRed, 'Pitch percent to change must be between 1 and 200'.red);
      return;
    }
    audioModifier.changePitch(args[1], parseInt(args[2]));
    break;

  case 'fade':
    if (!args[1]) {
      audioModifier.error('Invalid Parameter'.bgRed, 'You must enter a valid local path file'.red);
      return;
    }
    if (!args[2]) {
      audioModifier.error('Invalid Parameter'.bgRed, 'You must enter wished time to fade in/out'.red);
      return;
    }
    if (parseInt(args[2]) < 1 || parseInt(args[2]) > 30) {
      audioModifier.error('Invalid Parameter'.bgRed, 'Fade time must be between 1 and 30 seconds'.red);
      return;
    }
    audioModifier.createFade(args[1], parseInt(args[2]));
    break;

  case 'record':
    if (!args[1] || parseInt(args[1]) < 1) {
      audioModifier.error(
        'Invalid Parameter'.bgRed,
        'You must enter a valid seconds time to record mic (minimun 3 sec)'.red,
      );
      return;
    }
    audioModifier.recordMic(parseInt(args[1]));
    break;

  case 'play':
    if (!args[1]) {
      audioModifier.error('Invalid Parameter'.bgRed, 'You must enter a valid local path file'.red);
      return;
    }
    audioModifier.playAudioFile(args[1]);
    break;

  case 'effect':
    if (!args[1]) {
      audioModifier.error('Invalid Parameter'.bgRed, 'You must enter a valid local path file'.red);
      return;
    }
    if (
      !args[2] ||
      ![
        'REVERB',
        'ECHO',
        'CHORUS',
        'FLANGER',
        'DISTORT',
        'LOWPASS',
        'HIGHPASS',
        'BENDUP',
        'BENDDOWN',
        'REVERSE',
      ].includes(args[2].toUpperCase())
    ) {
      audioModifier.error(
        'Invalid Parameter'.bgRed,
        'You must enter a valid effect:'.red +
          '(reverb | echo | chorus | flanger | distort | lowpass | highpass | bendup | benddown | reverse)'.bgYellow
            .black,
      );
      return;
    }
    audioModifier.applyEffect(args[1], args[2]);
    break;

  default:
    audioModifier.error('Error'.bgRed, 'Sorry, enter a valid operation'.red);
    audioModifier.error(
      'Valid operations:'.bgYellow.red,
      '(normalize | volume | split | pitch | fade | record | play | effect)'.bgYellow.black,
    );
}
