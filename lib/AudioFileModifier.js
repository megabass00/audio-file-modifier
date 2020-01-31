require('colors');
const path = require('path');
const player = require('play-sound')((opts = {}));
// const Mic = require('mic');
// const lame = require('lame');
// "lame": "github:suldashi/node-lame",
// "mic": "^2.1.2",
const fs = require('fs');
const tmp = require('tmp');
const progressStream = require('progress-stream');

const Sox = require('sox-stream');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfprobePath(ffprobePath);

/**
 *  You can pass several options to constructor:
 *    inFile (string):        input file path (you must enter a valid audio file path)
 *    outFile (string):       output file path
 *    overwrite (boolean):    input file will be overwritted
 *    volume (integer):       output final volume
 *    sampleRate (integer):   output sample rate
 *    channels (integer):     output number channels
 *    pitch (integer):        pitch percent to transform file (1% to 200%)
 *    fade (integer):         if you specify this param the tool will create fadeIn and fadeOut with value you pass
 *    fadeIn (integer):       miliseconds to create fade in, if you do not specify fadeOut param it will not create fade out
 *    fadeOut (integer):      miliseconds to create fade out, if you do not specify fadeIn param it will not create fade in
 *    recTime (integer):      seconds to recording stdin (mic)
 *    verbose (boolean):      it will show or not logs by console (default is true)
 *
 *  Also you can specify events:
 *    onStart (function):     is launched when process starts
 *    onProgress (function):  informs of progress percent
 *    onEnd (function):       is launched when process ends succesfully
 *    onError (function):     reports if an error occurs
 */
module.exports = class AudioFileNormalize {
  constructor(options) {
    console.clear();
    this.config = this.defaultConfig(options);
    this.printLogo();
    this.info('Initialized with config'.gray, this.config);
    this.log('FFMPEG module path'.gray, ffmpegPath.yellow);
  }

  printLogo() {
    console.log(
      `
     _______  __   __  ______   ___   _______    _______  ___   ___      _______   
    |   _   ||  | |  ||      | |   | |       |  |       ||   | |   |    |       |  
    |  |_|  ||  | |  ||  _    ||   | |   _   |  |    ___||   | |   |    |    ___|  
    |       ||  |_|  || | |   ||   | |  | |  |  |   |___ |   | |   |    |   |___   
    |       ||       || |_|   ||   | |  |_|  |  |    ___||   | |   |___ |    ___|  
    |   _   ||       ||       ||   | |       |  |   |    |   | |       ||   |___   
    |__| |__||_______||______| |___| |_______|  |___|    |___| |_______||_______|  
         __   __  _______  ______   ___   _______  ___   _______  ______           
        |  |_|  ||       ||      | |   | |       ||   | |       ||    _ |          
        |       ||   _   ||  _    ||   | |    ___||   | |    ___||   | ||          
        |       ||  | |  || | |   ||   | |   |___ |   | |   |___ |   |_||_         
        |       ||  |_|  || |_|   ||   | |    ___||   | |    ___||    __  |        
        | ||_|| ||       ||       ||   | |   |    |   | |   |___ |   |  | |        
        |_|   |_||_______||______| |___| |___|    |___| |_______||___|  |_|        
      
 
  `.yellow +
        'By '.gray +
        'megabass00'.green +
        '\n\n\n',
    );
  }

  async normalizeFile(pathToFile) {
    const inFile = pathToFile || this.config.inFile;
    const outFile = this.getOutFile();
    this.config.inFile = inFile;
    this.info('Normalizing volume on '.yellow + this._urlParts(inFile).base.green);
    await this.printFileInfo(inFile);

    const getMaxDbFromText = output => {
      const regexp = /(max_volume: -*\d*\.\d* dB)/;
      const match = regexp.exec(output);
      let result = match && match.length > 0 ? match[0].replace('max_volume: ', '') : '0.0 dB';
      result = result.replace(' ', '');
      return result;
    };

    return new Promise((resolve, reject) => {
      ffmpeg(inFile)
        .withAudioFilter('volumedetect')
        .addOption('-f', 'null')
        .on('start', commandLine => {
          this.info('Spawned FFmpeg with command', `${commandLine}`.yellow);
          if (this.config.onStart) this.config.onStart(commandLine);
        })
        .on('error', (err, stdout, stderr) => {
          this.log('An error occurred: ' + err.message);
          if (this.config.onError) this.config.onError(err);
          reject(Error(err));
        })
        .on('end', (stdout, stderr) => {
          const maxVolume = getMaxDbFromText(stderr);
          if (maxVolume == '0.0dB') {
            this.info('Now volume is 0.0 dB'.green, 'it is not necessary file normalization'.yellow);
            resolve();
            return;
          }

          const newVolume = maxVolume.replace('-', '');
          this.info('Audio normalization to'.yellow, newVolume.green);

          // ffmpeg -i INPUT.mp3 -af "volume=10.7dB" -strict -2 INPUT_NORMALIZED.mp3
          ffmpeg(inFile)
            .withAudioFilter('volume=' + newVolume)
            .output(outFile)
            .on('progress', progress => {
              const percent = Math.round((progress.percent + Number.EPSILON) * 100) / 100;
              this.info('Normalizing '.gray + `${percent}%`.cyan);
              if (this.config.onProgress) this.config.onProgress(percent);
            })
            .on('error', (err, stdout, stderr) => {
              this.log('An error occurred: ' + err.message);
              if (this.config.onError) this.config.onError(err);
              reject(Error(err));
            })
            .on('end', async () => {
              await this._finishOperation(outFile);
              resolve();
            })
            .run();
        })
        .saveToFile('/dev/null');
    });
  }

  async changeFileVolume(pathToFile, outVolume) {
    const inFile = pathToFile || this.config.inFile;
    const outFile = this.getOutFile();
    this.config.inFile = inFile;
    await this.printFileInfo(inFile);
    this.info(
      'Changing volume to '.yellow + String(outVolume + '%').green + ' on '.yellow + this._urlParts(inFile).base.green,
    );

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inFile, (error, metadata) => {
        if (error) {
          this.error('Error', error);
          reject(Error(err));
          return;
        }
        ffmpeg(inFile)
          .audioFilters(
            {
              filter: 'volume',
              options: {
                enable: `between(t,0,${metadata.format.duration}/2)`,
                volume: outVolume / 100,
              },
            },
            {
              filter: 'volume',
              options: {
                enable: `between(t,${metadata.format.duration}/2, ${metadata.format.duration})`,
                volume: '1',
              },
            },
          )
          .on('start', commandLine => {
            this.info('Spawned FFmpeg with command', `${commandLine}`.yellow);
            if (this.config.onStart) this.config.onStart(commandLine);
          })
          .on('progress', progress => {
            const percent = Math.round((progress.percent + Number.EPSILON) * 100) / 100;
            this.info('Changing volume '.gray + `${percent}%`.cyan);
            if (this.config.onProgress) this.config.onProgress(percent);
          })
          .on('end', async () => {
            await this._finishOperation(outFile);
            resolve();
          })
          .on('error', err => {
            this.error('Cannot process audio: ' + err.message);
            if (this.config.onError) this.config.onError(err);
            reject(Error(err));
          })
          .save(outFile);
      });
    });
  }

  async splitSilences(pathToFile) {
    const inFile = pathToFile || this.config.inFile;
    const outFile = this.getOutFile();
    this.config.inFile = inFile;
    await this.printFileInfo(inFile);
    this.info('Splitting begin and end silences on '.yellow + this._urlParts(inFile).base.green);

    return new Promise((resolve, reject) => {
      ffmpeg(inFile)
        .audioFilters('volume=0.2')
        .audioFilters('silencedetect=n=-50dB:d=5')
        .output(outFile)
        .on('start', commandLine => {
          this.info('Spawned FFmpeg with command', `${commandLine}`.yellow);
          if (this.config.onStart) this.config.onStart(commandLine);
        })
        .on('progress', progress => {
          const percent = Math.round((progress.percent + Number.EPSILON) * 100) / 100;
          this.info('Spliting silences '.gray + `${percent}%`.cyan);
          if (this.config.onProgress) this.config.onProgress(percent);
        })
        .on('end', async () => {
          await this._finishOperation(outFile);
          resolve();
        })
        .on('error', err => {
          this.error('Cannot process audio: ' + err.message);
          if (this.config.onError) this.config.onError(err);
          reject(Error(err));
        })
        .run();
    });
  }

  async changePitch(pathToFile, pitchPercent = 90) {
    if (!pitchPercent || parseInt(pitchPercent) < 1 || parseInt(pitchPercent) > 200) {
      this.error('PitchPercent value wrong', 'You must enter a value between 1% and 200%');
      return;
    }

    const inFile = pathToFile || this.config.inFile;
    const outFile = this.getOutFile();
    this.config.inFile = inFile;
    await this.printFileInfo(inFile);
    this.info(
      'Changing pitch to ' + String(pitchPercent + '%').green + ' on '.gray + this._urlParts(inFile).base.green,
    );

    const originalRate = await this.getSampleRate(inFile);
    const ratio = 1 - Math.round(100 - pitchPercent) / 100;
    const pitchRate = originalRate * ratio;
    // const pitchTempo = 2 - ratio;

    return new Promise((resolve, reject) => {
      // asetrate=44100*0.9,aresample=44100,atempo=1.1
      ffmpeg(inFile)
        .audioFilters(`asetrate=${pitchRate}`)
        // .audioFilters(`atempo=${pitchTempo}`)
        .audioFilters(`aresample=${originalRate}`)
        .output(outFile)
        .on('start', commandLine => {
          this.info('Spawned FFmpeg with command', `${commandLine}`.yellow);
          if (this.config.onStart) this.config.onStart(commandLine);
        })
        .on('progress', progress => {
          const percent = Math.round((progress.percent + Number.EPSILON) * 100) / 100;
          this.info('Pitching '.gray + `${percent}%`.cyan);
          if (this.config.onProgress) this.config.onProgress(percent);
        })
        .on('end', async () => {
          await this._finishOperation(outFile);
          resolve();
        })
        .on('error', err => {
          this.error('Cannot process audio: ' + err.message);
          if (this.config.onError) this.config.onError(err);
          reject(Error(err));
        })
        .run();
    });
  }

  async createFade(pathToFile, time) {
    const fadeTime = time || this.config.fade;
    const fadeIn = fadeTime || this.config.fadeIn;
    const fadeOut = fadeTime || this.config.fadeOut;
    const inFile = pathToFile || this.config.inFile;
    const outFile = this.getOutFile();
    this.config.inFile = inFile;

    this.info(
      'Creating to ' +
        this._urlParts(inFile).base.green +
        ' fade in with '.gray +
        String(fadeIn).green +
        ' seconds and fade out with '.gray +
        String(fadeOut).green +
        ' seconds'.gray,
    );
    await this.printFileInfo(inFile);

    const audioFileDuration = await this.getDuration(inFile);

    return new Promise((resolve, reject) => {
      // afade=in:st=0:d=1, afade=out:st=59:d=1"
      ffmpeg(inFile)
        .audioFilters(`afade=in:st=0:d=${fadeIn}`)
        .audioFilters(`afade=out:st=${audioFileDuration - fadeOut}:d=${fadeOut}`)
        .output(outFile)
        .on('start', commandLine => {
          this.info('Spawned FFmpeg with command', `${commandLine}`.yellow);
          if (this.config.onStart) this.config.onStart(commandLine);
        })
        .on('progress', progress => {
          const percent = Math.round((progress.percent + Number.EPSILON) * 100) / 100;
          this.info('Creating fades '.gray + `${percent}%`.cyan);
          if (this.config.onProgress) this.config.onProgress(percent);
        })
        .on('end', async () => {
          await this._finishOperation(outFile);
          resolve();
        })
        .on('error', err => {
          this.error('Cannot process audio: ' + err.message);
          if (this.config.onError) this.config.onError(err);
          reject(Error(err));
        })
        .run();
    });
  }

  /*async recordMic(time) {
    const recordingTime = time || this.config.recTime;
    const outputFile = this.config.outFile;
    this.info(
      'Recording mic for ' +
        String(recordingTime).green +
        ' seconds'.green +
        ' on '.yellow +
        this._urlParts(outputFile).base.green,
    );

    // const devicesList = await this.getDeviceList();
    // if (!devicesList || devicesList.length == 0) {
    //   this.error('It is not possible recording mic', 'No device input avaible');
    //   return;
    // }
    // const preferInput = devicesList[0];
    // this.log('Prefer Input'.gray, preferInput);

    const writeStream = this.getWriteStream(outputFile);
    const encoder = new lame.Encoder({
      channels: this.config.channels,
      bitDepth: this.config.bitDepth,
      sampleRate: this.config.sampleRate,
      bitRate: this.config.bitRate,
      outSampleRate: this.config.sampleRate,
      mode: this.config.mode,
    });
    const mic = Mic({
      rate: this.config.sampleRate,
      channels: '1', // TODO: in stereo mode no works how expects (this.config.channels)
      debug: this.config.verbose,
      exitOnSilence: 5, // it will exit automatically when silent for 5 seconds
    });
    const micStream = mic
      .getAudioStream()
      .on('data', data => this.log('Recieved Input Stream', data.length + ' bytes'))
      .on('error', error => this.error('Error in Input Stream', error))
      .on('startComplete', () => {
        this.log('Got SIGNAL startComplete!!!');
        setTimeout(function() {
          mic.stop();
        }, this.config.recTime * 1000);
      });

    micStream.pipe(encoder);
    encoder.pipe(writeStream);

    mic.start();
  }*/

  async playAudioFile(pathToFile) {
    const inFile = pathToFile || this.config.inFile;
    await this.printFileInfo(inFile);
    this.info('Playing ' + this._urlParts(inFile).base.green);
    this.info('Press Ctrl + C to stop playing...'.gray);

    player.play(pathToFile, err => {
      if (err) {
        return this.error(err);
      }
    });
  }

  async applyEffect(pathToFile, effect = 'REVERB') {
    const inFile = pathToFile || this.config.inFile;
    const outFile = this.getOutFile();
    this.config.inFile = inFile;
    const effectType = effect.toUpperCase();

    await this.printFileInfo(inFile);
    this.log(
      'Applying ' + effectType.green + ' effect to '.yellow + this._urlParts(inFile).base.green + ' file'.yellow,
    );

    // http://sox.sourceforge.net/sox.html#EFFECTS
    let transform;
    switch (effectType) {
      case 'REVERB': {
        // [reverberance (50%) [HF-damping (50%) [room-scale (100%) [stereo-depth (100%) [pre-delay (0ms) [wet-gain (0dB)]]]]]]
        transform = Sox({
          input: { type: 'mp3', volume: 0.7 },
          output: { type: 'mp3' },
          effects: ['reverb', 50, 60, 60, 10, 0, -6],
        });
        break;
      }
      case 'ECHO': {
        // gain-in gain-out <delay decay>
        transform = Sox({
          input: { type: 'mp3', volume: 0.6 },
          output: { type: 'mp3' },
          effects: ['echos', 0.9, 0.05, 300, 0.25, 600, 0.08, 900, 0.015],
        });
        break;
      }
      case 'CHORUS': {
        // gain-in gain-out <delay decay speed depth −s|−t>
        transform = Sox({
          input: { type: 'mp3', volume: 0.8 },
          output: { type: 'mp3' },
          effects: ['chorus', 0.9, 0.5, 25, 0.8, 0.5, 9.0, '-s'],
        });
        break;
      }
      case 'FLANGER': {
        // [delay depth regen width speed shape phase interp]
        transform = Sox({
          input: { type: 'mp3', volume: 0.8 },
          output: { type: 'mp3' },
          effects: ['flanger', 20, 10, 90, 100, 1.5, 'sine', 'linear'],
        });
        break;
      }
      case 'DISTORT': {
        // [gain(20) [colour(20)]]
        transform = Sox({
          input: { type: 'mp3', volume: 0.8 },
          output: { type: 'mp3' },
          effects: ['overdrive', 20, 30],
        });
        break;
      }
      case 'LOWPASS': {
        // [−1|−2] frequency[k] [width[q|o|h|k]]
        transform = Sox({
          input: { type: 'mp3', volume: 0.8 },
          output: { type: 'mp3' },
          effects: ['lowpass', -2, 1800],
        });
        break;
      }
      case 'HIGHPASS': {
        // [−1|−2] frequency[k] [width[q|o|h|k]]
        transform = Sox({
          input: { type: 'mp3', volume: 0.8 },
          output: { type: 'mp3' },
          effects: ['highpass', -2, 340],
        });
        break;
      }
      case 'BENDUP': {
        //  [−f frame-rate(25)] [−o over-sample(16)] { start-position(+),cents,end-position(+) }
        const duration = parseFloat(await this.getDuration(inFile)) - 0.1; // minus 0.1 sec to avoid errors;
        transform = Sox({
          input: { type: 'mp3', volume: 0.5 },
          output: { type: 'mp3' },
          effects: ['bend', '-f', 25, '-o', 16, `0,2000,${duration}`],
        });
        break;
      }
      case 'BENDDOWN': {
        //  [−f frame-rate(25)] [−o over-sample(16)] { start-position(+),cents,end-position(+) }
        const duration = parseFloat(await this.getDuration(inFile)) - 0.1; // minus 0.1 sec to avoid errors;
        transform = Sox({
          input: { type: 'mp3', volume: 0.5 },
          output: { type: 'mp3' },
          effects: ['bend', '-f', 25, '-o', 16, `0,-2000,${duration}`],
        });
        break;
      }
      case 'REVERSE': {
        transform = Sox({
          input: { type: 'mp3' },
          output: { type: 'mp3' },
          effects: ['reverse'],
        });
        break;
      }
    }

    return new Promise((resolve, reject) => {
      fs.stat(inFile, (err, stat) => {
        if (err) {
          this.error('FileSystem stat error', err.message);
          if (this.config.onError) this.config.onError(err);
          reject(Error(err));
        } else {
          const filesize = stat.size;
          let bytesCopied = 0;

          const readStream = fs.createReadStream(inFile);
          readStream.on('data', buffer => {
            if (bytesCopied == 0) this.info('Input file has started to be read');
            bytesCopied += buffer.length;
            const percent = Math.round((bytesCopied / filesize) * 100 * 100) / 100;
            this.info('Readed '.gray + `${percent}%`.cyan);
          });
          readStream.on('end', () => this.info('Input file has been readed succesfully'));

          const progress = progressStream({
            length: stat.size,
            time: 100 /* ms */,
          });
          progress.on('progress', progress => {
            const percent = Math.round((progress.percentage + Number.EPSILON) * 100) / 100;
            this.info('Applying FX '.gray + `${percent}%`.cyan);
            if (this.config.onProgress) this.config.onProgress(percent);
          });

          const writeStream = this.getWriteStream(outFile);
          writeStream.on('close', async () => {
            await this._finishOperation(outFile, 'SoX has finished to apply fx successfully');
            resolve();
          });

          transform.on('error', err => {
            this.error('Sox Error', err.message);
            if (this.config.onError) this.config.onError(err);
            reject(Error(err));
          });

          readStream
            .pipe(transform)
            .pipe(progress)
            .pipe(writeStream);
        }
      });
    });
  }

  defaultConfig(options) {
    /**
     *    inFile (string):        input file path (you must enter a valid audio file path)
     *    outFile (string):       output file path
     *    overwrite (boolean):    input file will be overwritted
     *    volume (integer):       output final volume
     *    sampleRate (integer):   output sample rate
     *    channels (integer):     output number channels
     *    pitch (integer):        pitch percent to transform file (1% to 200%)
     *    fade (integer):         if you specify this param the tool will create fadeIn and fadeOut with value you pass (default is false)
     *    fadeIn (integer):       miliseconds to create fade in, if you do not specify fadeOut param it will not create fade out
     *    fadeOut (integer):      miliseconds to create fade out, if you do not specify fadeIn param it will not create fade in
     *    recTime (integer):      seconds to recording stdin(mic)
     *    verbose (boolean):      it will show or not logs by console (default is true)
     *    mode (auto):            this option will be calculated based on number of channels
     *  Also you can specify events:
     *    onStart (function):     is launched when process starts
     *    onProgress (function):  informs of progress percent
     *    onEnd (function):       is launched when process ends succesfully
     *    onError (function):     reports if an error occurs
     */
    const {
      inFile,
      overwrite,
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
      onStart,
      onProgress,
      onEnd,
      onError,
    } = options;
    console.log(inFile);
    const inFilePath = inFile && fs.existsSync(inFile) ? inFile : false;
    const outFileName = outFile || 'output.mp3';
    const outFilePath =
      outFileName.indexOf('/') > -1 ? outFileName : path.resolve(__dirname, '../processed', outFileName);
    const numChannels = channels && parseInt(channels) > 2 ? 2 : parseInt(channels) === 1 ? 1 : 2;
    return {
      inFile: inFilePath,
      outFile: outFilePath,
      overwrite: this._parseBoolean(overwrite),
      volume: volume || 1.0,
      sampleRate: sampleRate || 44100,
      channels: numChannels,
      pitch: pitch || 110,
      fade: fade || false,
      fadeIn: fadeIn || 5,
      fadeOut: fadeOut || 5,
      recTime: recTime || 10,
      verbose: this._parseBoolean(verbose),
      mode: numChannels > 1 ? 'STEREO' : 'MONO',
      // mode: numChannels > 1 ? lame.STEREO : lame.MONO, // STEREO (default), JOINTSTEREO, DUALCHANNEL or MONO
      onStart,
      onProgress,
      onEnd,
      onError,
    };
  }

  // HELPERS //
  async printFileInfo(pathToFile) {
    this.info('Duration', this.getFormmattedTime(await this.getDuration(pathToFile)));
    this.info('Sample Rate', (await this.getSampleRate(pathToFile)) + ' Hz');
    this.info('Bit Rate', (await this.getBitRate(pathToFile)) + ' kbits');
    this.info('Mode', (await this.getNumberOfChannels(pathToFile)) > 1 ? 'Stereo' : 'Mono');
  }

  async getSampleRate(pathToFile) {
    const metadata = await this.getMetadata(pathToFile);
    return metadata && metadata.sampleRate ? metadata.sampleRate.toPrecision() : 0;
  }

  async getBitRate(pathToFile) {
    const metadata = await this.getMetadata(pathToFile);
    return metadata && metadata.bitrate ? metadata.bitrate.toPrecision() / 1024 : 0;
  }

  async getDuration(pathToFile) {
    const metadata = await this.getMetadata(pathToFile);
    return metadata && metadata.duration ? metadata.duration.toPrecision() : 0;
  }

  async getNumberOfChannels(pathToFile) {
    const metadata = await this.getMetadata(pathToFile);
    return metadata && metadata.numberOfChannels ? metadata.numberOfChannels.toPrecision() : 1;
  }

  async getMetadata(pathToFile) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(pathToFile, (error, metadata) => {
        if (error) {
          this.error('Error', error);
          reject(error);
        }
        const { sample_rate, channels, duration, bit_rate, codec_name, codec_type } = metadata.streams[0];
        const stats = fs.statSync(pathToFile);
        const bytes = stats.size || 0;
        resolve({
          bitrate: bit_rate,
          numberOfChannels: channels,
          sampleRate: sample_rate,
          duration: duration,
          bytes: bytes,
          size: this._getReadableFileSizeString(bytes),
        });
      });
    });
  }

  async getDeviceList(type = 'audio') {
    const { parse } = require('ffmpeg-device-list-parser');
    return await parse({ ffmpegPath: ffmpegPath })
      .then(result => {
        if (type == 'audio') return result.audioDevices;
        if (type == 'video') return result.videoDevices;
        return result;
      })
      .catch(err => {
        this.error('Error getting devices list', err);
        return null;
      });
  }

  getWriteStream(pathToFile) {
    return fs
      .createWriteStream(pathToFile)
      .on('open', fd => this.log('File is open'.gray))
      .on('pipe', source => this.log('Audio data is being piped'.gray))
      .on('finish', () => this.log('File is finished'.gray))
      .on('close', () => {
        this.log('File is closed'.gray);
        if (this.config.onEnd) this.config.onEnd();
      })
      .on('error', err => {
        this.log('ERROR'.red, err);
        if (this.config.onEnd) this.config.onEnd(err);
      });
  }

  getFormmattedTime(seconds) {
    var sec_num = parseInt(seconds, 10);
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - hours * 3600) / 60);
    var seconds = sec_num - hours * 3600 - minutes * 60;

    if (hours < 10) hours = '0' + hours;
    if (minutes < 10) minutes = '0' + minutes;
    if (seconds < 10) seconds = '0' + seconds;
    return hours > 0
      ? hours + ':' + minutes + ':' + seconds
      : minutes > 0
      ? minutes + ':' + seconds
      : seconds + ' secs';
  }

  _finishOperation(outFile, msg = 'Processing finished successfully') {
    return new Promise((resolve, reject) => {
      if (this.config.overwrite) {
        fs.copyFile(outFile, this.config.inFile, err => {
          if (err) {
            reject(err);
            // throw err;
          }
          this.config.tmpFile.removeCallback();
          this.info('Overwrited original file');
          this.info(msg);
          if (this.config.onEnd) this.config.onEnd();
          resolve();
        });
      } else {
        this.info(msg);
        if (this.config.onEnd) this.config.onEnd();
        resolve();
      }
    });
  }

  _urlParts(pathToFile) {
    // '/home/user/dir/file.txt' returs:
    // root: '/',
    // dir: '/home/user/dir',
    // base: 'file.txt',
    // ext: '.txt',
    // name: 'file'
    return path.parse(pathToFile);
  }

  _parseBoolean(value) {
    return typeof value === 'undefined' || value === null ? true : value || value === 'true' ? true : false;
  }

  _getReadableFileSizeString(fileSizeInBytes) {
    let i = -1;
    const byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
      fileSizeInBytes = fileSizeInBytes / 1024;
      i++;
    } while (fileSizeInBytes > 1024);
    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
  }

  getOutFile() {
    if (this.config.overwrite) {
      this.config.tmpFile = tmp.fileSync();
      const tmpName = this.config.tmpFile.name + '.mp3';
      this.info('Using temp file'.yellow, tmpName);
      return tmpName;
    }
    return this.config.outFile;
  }

  // VERBOSE //
  log(key, value = ' ') {
    if (!this.config.verbose) return;
    if (!key) key = 'NO KEY'.red;
    if (typeof value === 'object') value = JSON.stringify(value, null, 3).green;
    if (typeof value === 'boolean') value = !value ? 'false' : 'true';
    if (!value) value = 'UNDEFINED'.red;
    console.log(key.yellow, value.green);
  }

  info(key, value = ' ') {
    if (!key) key = 'Info'.gray;
    if (typeof value === 'object') value = JSON.stringify(value, null, 3).cyan;
    if (typeof value === 'boolean') value = !value ? 'false' : 'true';
    if (!value) value = 'UNDEFINED'.cyan;
    console.log(key.gray, value.cyan);
  }

  error(key, error = ' ') {
    if (!error || (typeof error == 'object' && Object.keys(error).length === 0)) error = 'No error info'.red.bgYellow;
    if (typeof error === 'object') error = JSON.stringify(error, null, 3);
    this.log(key.bgRed, error.red.bgYellow);
  }
};
