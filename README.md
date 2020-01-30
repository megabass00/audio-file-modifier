# Audio File Modifier

The purpose of this tool that runs in Node.js is to do several operations (normalize, split silences, apply a effect...) on audio files that the user wishes to process.

## Install

You need to have installed [Node.js](https://nodejs.org/es/download/) and npm. Also you must have installed [SoX](http://sox.sourceforge.net/) to can apply effects. Once you have your system ready you must clone this repo on your computer:

```
# Clone this repository
git clone https://github.com/megabass00/audio-file-normalize.git

# Install dependencies
cd audio-file-normalize
npm i
```

### Windows installation

If you are a Windows user you should copy **libmad0.dll** and **libmp3lame-0.dll** (both included in this repo, on **libmad & libmp3lame** folder) into SoX installation folder (C:\Windows\Program Files (x86)\SoX-installation-folder). If you do not copy this files when you run effects tool you will get a error becouse your system will be not able to manipulate mp3 files.

### MacOS installation

If you wish run this tool on a MacOS system you must have to install a Node version minor than 12.x. For the moment is not possible run some libraries on 12.x versions.

# Operations

Bellow you can see avaible operations you can do:

- **normalize**: You can normalize any local sound file wich you spcify.
- **volume**: You can change volume on any local file wich you specify.
- **split**: You can remove the initial and final blank parts.
- **fade**: You can apply fade in/out/both to any local sound file.
- **pitch**: You can change pitch on any local audio file.
- **effect**: You can apply an effect to an audio file between several types.
- **play**: You can play any song from your local disk.
- **record** (disabled): You can record mic built-in signal and save in a mp3 file. You need to have installed on your machine sox (Mac/Windows Users) or ALSA tools for Linux.

# Options

You can use the tool with several options to modify behaviour:

- **inFile**: input file path (you must enter a valid audio file path)
- **outFile**: output file path
- **overwrite**: input file will be overwritted
- **volume**: output final volume
- **sampleRate**: output sample rate
- **channels**: output number channels
- **pitch**: pitch percent to transform file (1% to 200%)
- **fade**: if you specify this param the tool will create fadeIn and fadeOut with value you pass (default is false)
- **fadeIn**: miliseconds to create fade in, if you do not specify fadeOut param it will not create fade out
- **fadeOut**: miliseconds to create fade out, if you do not specify fadeIn param it will not create fade in
- **recTime**: seconds to recording stdin(mic)
- **verbose**: it will show or not logs by console (default is true)

## Examples for use

```
# normalize volume of a local file
npm start normalize <path-to-audio-file>

# change volume to 20% more
npm start volume <path-to-audio-file> 120

# remove blank parts of a local file (begin and end)
npm start aplit <path-to-audio-file>

# create fade in/out with 5 secs to both
npm start fade <path-to-audio-file> 5

# change pitch to 20% less
npm start pitch <path-to-audio-file> 80

# record built-in mic for 30 seconds
npm start record 30

# play of a local file
npm start play <path-to-audio-file>

# apply a effect to a local file
npm start effect <path-to-audio-file> reverb|echo|chorus|flanger|distort|lowpass|highpass|bendup|benddown|reverse
```

### Colaborations

Special thanks to :squirrel: Joan and :japanese_ogre: X-Hunter for their support.
