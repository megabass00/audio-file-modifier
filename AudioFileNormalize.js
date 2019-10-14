var Speaker = require('speaker');
var lame = require('lame');
var fs = require('fs');
var PcmVolume = require('pcm-volume');
require('colors');

module.exports = class AudioFileNormalize {
  constructor() {
    console.clear();
    this.volume = 1.0;
  }

  normalizeFile(pathToFile) {
    // const readStream = fs.createReadStream(pathToFile);
    const readStream = fs.createReadStream('C:/Users/usuario/Projects/custom/prueba.mp3');
    const writeStream = fs
      .createWriteStream('C:/Users/usuario/Projects/custom/output.mp3')
      .on('open', fd => {
        this.log('File is open'.gray);
        // this.log('fd: ' + fd);
      })
      .on('pipe', () => {
        this.log('Something is being piped in'.gray);
      })
      .on('finish', () => {
        this.log('File is finished'.gray);
      })
      .on('close', () => {
        this.log('File is closed'.gray);
      })
      .on('error', err => {
        this.log('ERROR'.red, err);
      });

    const decoder = new lame.Decoder({
      // input
      channels: 2, // 2 channels (left and right)
      bitDepth: 16, // 16-bit samples
      sampleRate: 44100, // 44,100 Hz sample rate

      // output
      bitRate: 128,
      outSampleRate: 22050,
      mode: lame.STEREO, // STEREO (default), JOINTSTEREO, DUALCHANNEL or MONO
    });
    const encoder = new lame.Encoder({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100,
      bitRate: 128,
      outSampleRate: 22050,
      mode: lame.STEREO,
    });

    // const speaker = new Speaker();
    const volume = new PcmVolume();

    // Wait 5s, then change the volume to 50%
    // setTimeout(function() {
    //   volume.setVolume(0.5); //this.volume
    // }, 5000);
    volume.setVolume(0.2);

    // volume.pipe(new Speaker()); // pipe volume to speaker
    // volume.pipe(writeStream);
    encoder.pipe(writeStream);
    volume.pipe(encoder);
    decoder.pipe(volume); // pipe PCM data to volume
    readStream.pipe(decoder); // pipe file input to decoder
  }

  log(key, value = ' ') {
    if (!key) key = 'NO KEY'.red;
    if (typeof value === 'object') value = JSON.stringify(value, null, 3).green;
    if (typeof value === 'boolean') value = !value ? 'false' : 'true';
    if (!value) value = 'UNDEFINED'.red;
    console.log(key.yellow, value.green);
  }
};
