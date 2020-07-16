/**
 * (C) Copyright IBM Corp. 2019.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint camelcase: off */
import React, {Component} from 'react';
import {Checkbox} from 'carbon-components-react';
import {Colors, Icon, Pane, Tabs} from 'watson-react-components';
import recognizeMicrophone from 'watson-speech/speech-to-text/recognize-microphone';
import 'whatwg-fetch';
import Transcript from './transcript.jsx'
import JSONView from './json-view.jsx'

/**
 * @return {Function} A polyfill for URLSearchParams
 */
const getSearchParams = () => {
  if (typeof URLSearchParams === 'function') {
    return new URLSearchParams();
  }

  // Simple polyfill for URLSearchparams
  const SearchParams = function SearchParams() {
  };

  SearchParams.prototype.set = function set(key, value) {
    this[key] = value;
  };

  SearchParams.prototype.toString = function toString() {
    return Object.keys(this).map(v => `${encodeURI(v)}=${encodeURI(this[v])}`).join('&');
  };

  return new SearchParams();
};

/**
 * Validates that the mimetype is: audio/wav, audio/mpeg;codecs=mp3 or audio/ogg;codecs=opus
 * @param  {String} mimeType The audio mimetype
 * @return {bool} Returns true if the mimetype can be played.
 */
const canPlayAudioFormat = (mimeType) => {
  const audio = document.createElement('audio');
  if (audio) {
    return (typeof audio.canPlayType === 'function' && audio.canPlayType(mimeType) !== '');
  }
  return false;
};

// Start with the default voice until the list is loaded.
const INIT_MODEL = { name: 'init', description: 'Loading...' };
const INIT_VOICE = { name: 'init', description: 'Loading...' };
const INIT_MODELS = [ INIT_MODEL ];

export default class Demo extends Component {
  constructor(props) {
    super(props);
    this.state = {
      voices: null,
      target_voices: null,
      voice: INIT_VOICE,
      error: null, // the error from calling /classify
      text: null,
      loading: false,
      modelMap: {},
      models: INIT_MODELS,
      model: INIT_MODEL,
      rawMessages: [],
      formattedMessages: [],
      translating: false,
      speaking: true,
      translatedMessages: [],
      translatedResults: [],
      audioSource: null,
      speakerLabels: false,
      settingsAtStreamStart: {
        model: '',
        speakerLabels: false,
      },
    };


    this.audioElementRef = React.createRef();

    this.fetchToken = this.fetchToken.bind(this);
    this.onSpeak = this.onSpeak.bind(this);
    this.onModelChange = this.onModelChange.bind(this);
    this.onVoiceChange = this.onVoiceChange.bind(this);
    this.onAudioLoaded = this.onAudioLoaded.bind(this);
    this.setupParamsForTranslate = this.setupParamsForTranslate.bind(this);
    this.setupParamsFromState = this.setupParamsFromState.bind(this);
    this.handleAudioError = this.handleAudioError.bind(this);
    this.reset = this.reset.bind(this);
    this.captureSettings = this.captureSettings.bind(this);
    this.stopTranscription = this.stopTranscription.bind(this);
    this.getRecognizeOptions = this.getRecognizeOptions.bind(this);
    this.handleMicClick = this.handleMicClick.bind(this);
    this.handleTranslateClick = this.handleTranslateClick.bind(this);
    this.doLanguageTranslation = this.doLanguageTranslation.bind(this);
    this.handleStream = this.handleStream.bind(this);
    this.handleRawMessage = this.handleRawMessage.bind(this);
    this.handleFormattedMessage = this.handleFormattedMessage.bind(this);
    this.handleTranscriptEnd = this.handleTranscriptEnd.bind(this);
    this.getFinalResults = this.getFinalResults.bind(this);
    this.getCurrentInterimResult = this.getCurrentInterimResult.bind(this);
    this.getFinalAndLatestInterimResult = this.getFinalAndLatestInterimResult.bind(this);
    this.handleError = this.handleError.bind(this)

  }

  reset() {
    this.setState({
      rawMessages: [],
      formattedMessages: [],
      translatedMessages: [],
      translatedResults: [],
      error: null,
      text: null
    });
  }

  /**
   * The behavior of several of the views depends on the settings when the
   * transcription was started. So, this stores those values in a settingsAtStreamStart object.
   */
  captureSettings() {
    const { model, speakerLabels } = this.state;
    this.setState({
      settingsAtStreamStart: {
        model,
        speakerLabels,
      },
    });
  }

  handleTranslateClick() {
    const { translating } = this.state;
    let enabled = !translating;
    this.setState({ translating: enabled });
    if (enabled) {
      this.doLanguageTranslation(true);
    }
  }

  handleMicClick() {
    const { model, audioSource } = this.state;
    if (!model || !model.name || model.name === 'init') {
      this.handleError({ error: "Select a source language model." });
      return;
    }
    if (audioSource === 'mic') {
      this.stopTranscription();
      return;
    }
    this.reset();
    this.setState({ audioSource: 'mic' });

    // The recognizeMicrophone() method is a helper method provided by the watson-speech package
    // It sets up the microphone, converts and downsamples the audio, and then transcribes it
    // over a WebSocket connection
    // It also provides a number of optional features, some of which are enabled by default:
    //  * enables object mode by default (options.objectMode)
    //  * formats results (Capitals, periods, etc.) (options.format)
    //  * outputs the text to a DOM element - not used in this demo because it doesn't play nice
    // with react (options.outputElement)
    //  * a few other things for backwards compatibility and sane defaults
    // In addition to this, it passes other service-level options along to the RecognizeStream that
    // manages the actual WebSocket connection.
    this.handleStream(recognizeMicrophone(this.getRecognizeOptions()));
  }

  handleStream(stream) {
    // console.log(stream);
    // cleanup old stream if appropriate
    if (this.stream) {
      this.stream.stop();
      this.stream.removeAllListeners();
      this.stream.recognizeStream.removeAllListeners();
    }
    this.stream = stream;
    this.captureSettings();

    // grab the formatted messages and also handle errors and such
    stream.on('data', this.handleFormattedMessage)
      .on('end', this.handleTranscriptEnd)
      .on('error', this.handleError);

    // when errors occur, the end event may not propagate through the helper streams.
    // However, the recognizeStream should always fire a end and close events
    stream.recognizeStream.on('end', () => {
      if (this.state.error) {
        this.handleTranscriptEnd();
      }
    });

    // grab raw messages from the debugging events for display on the JSON tab
    stream.recognizeStream
      .on('message', (frame, json) => this.handleRawMessage({
        sent: false,
        frame,
        json
      }))
      .on('send-json', json => this.handleRawMessage({
        sent: true,
        json
      }))
      .once('send-data', () => this.handleRawMessage({
        sent: true,
        binary: true,
        data: true, // discard the binary data to avoid waisting memory
      }))
      .on('close', (code, message) => this.handleRawMessage({
        close: true,
        code,
        message
      }));

    // ['open','close','finish','end','error', 'pipe'].forEach(e => {
    //     stream.recognizeStream.on(e, console.log.bind(console, 'rs event: ', e));
    //     stream.on(e, console.log.bind(console, 'stream event: ', e));
    // });
  }

  handleRawMessage(msg) {
    const { rawMessages } = this.state;
    this.setState({ rawMessages: rawMessages.concat(msg) });
  }

  handleFormattedMessage(msg) {
    const { formattedMessages, translating, translatedMessages, translatedResults } = this.state;

    this.setState({ formattedMessages: formattedMessages.concat(msg) });

    if (translating) {
      this.doLanguageTranslation(false);
    }
  }

  doLanguageTranslation(sayAll) {
    const { translatedMessages, translatedResults, speaking } = this.state;

    let oldMessages = translatedMessages; // TODO: just a reference
    let finals = this.getFinalAndLatestInterimResult();  // TODO: rename not-final

    // If old/translated messages is longer than current, truncate before replacing.
    oldMessages.length = Math.min(oldMessages.length, finals.length);
    translatedResults.length = Math.min(oldMessages.length, translatedResults.length);

    let promises = [];
    for (let i = 0; i < finals.length; i += 1) {

      let transcript = finals[i].results[0].alternatives[0].transcript;

      // Translate the new or updated messages.
      if (transcript !== oldMessages[i]) {
        oldMessages[i] = transcript;
        if (transcript) {
          promises[i] = this.fetchTranslation(transcript, false);
        }
      }
    }

    Promise.all(promises).then(values => {
        for (let i = 0; i < finals.length; i += 1) {
          if (values[i] && values[i].translated) {
            translatedResults[i] = {results: [{alternatives: [{transcript: values[i].translated}]}]};
          }
        }
        this.setState({ translatedResults });

        if (speaking) {
          let text = false;
          if (sayAll) {
            // Say all the translated values (to catch-up when button is pushed).
            text = values.map(v => v.translated);
          } else if (finals[finals.length - 1].results[0].final) {
            // Only say the last final value (for speaking while transcribing/translating).
            if (values[finals.length - 1]) {
              text = [values[finals.length - 1].translated];
            }
          }

          if (text && text.length) {
            const params = this.setupParamsForTranslate(text);
            params.set('download', true);
            if (canPlayAudioFormat('audio/mp3')) {
              params.set('accept', 'audio/mp3');
            } else if (canPlayAudioFormat('audio/ogg;codec=opus')) {
              params.set('accept', 'audio/ogg;codec=opus');
            } else if (canPlayAudioFormat('audio/wav')) {
              params.set('accept', 'audio/wav');
            }
            const audio = this.audioElementRef.current;
            audio.setAttribute('type', 'audio/ogg;codecs=opus');
            audio.setAttribute('src', `/api/v1/synthesize?${params.toString()}`);
            this.setState({loading: true, hasAudio: false});
          }
        }
    })
  }

  handleTranscriptEnd() {
    // note: this function will be called twice on a clean end,
    // but may only be called once in the event of an error
    this.setState({ audioSource: null });
  }

  getFinalResults() {
    return this.state.formattedMessages.filter(r => r.results
      && r.results.length && r.results[0].final);
  }

  getCurrentInterimResult() {
    const r = this.state.formattedMessages[this.state.formattedMessages.length - 1];

    // When resultsBySpeaker is enabled, each msg.results array may contain multiple results.
    // However, all results in a given message will be either final or interim, so just checking
    // the first one still works here.
    if (!r || !r.results || !r.results.length || r.results[0].final) {
      return null;
    }
    return r;
  }

  getFinalAndLatestInterimResult() {
    const final = this.getFinalResults();
    const interim = this.getCurrentInterimResult();
    if (interim) {
      final.push(interim);
    }
    return final;
  }

  handleError(err, extra) {
    console.error(err, extra);
    if (err.name === 'UNRECOGNIZED_FORMAT') {
      err = 'Unable to determine content type from file name or header; mp3, wav, flac, ogg, opus, and webm are supported. Please choose a different file.';
    } else if (err.name === 'NotSupportedError' && this.state.audioSource === 'mic') {
      err = 'This browser does not support microphone input.';
    } else if (err.message === '(\'UpsamplingNotAllowed\', 8000, 16000)') {
      err = 'Please select a narrowband voice model to transcribe 8KHz audio files.';
    } else if (err.message === 'Invalid constraint') {
      // iPod Touch does this on iOS 11 - there is a microphone, but Safari claims there isn't
      err = 'Unable to access microphone';
    }
    this.setState({ error: err.message || err });
  }

  stopTranscription() {
    if (this.stream) {
      this.stream.stop();
      // this.stream.removeAllListeners();
      // this.stream.recognizeStream.removeAllListeners();
    }
    this.setState({ audioSource: null });
  }

  getRecognizeOptions(extra) {
    return Object.assign({
      // formats phone numbers, currency, etc. (server-side)
      accessToken: this.state.accessToken,
      token: this.state.token,
      smart_formatting: true,
      format: true, // adds capitals, periods, and a few other things (client-side)
      model: this.state.model.name,
      objectMode: true,
      interim_results: true,
      // note: in normal usage, you'd probably set this a bit higher
      word_alternatives_threshold: 0.01,
      timestamps: true, // set timestamps for each word - automatically turned on by speaker_labels
      // includes the speaker_labels in separate objects unless resultsBySpeaker is enabled
      speaker_labels: this.state.speakerLabels,
      // combines speaker_labels and results together into single objects,
      // making for easier transcript outputting
      resultsBySpeaker: this.state.speakerLabels,
      // allow interim results through before the speaker has been determined
      speakerlessInterim: this.state.speakerLabels,
      url: this.state.serviceUrl,
    }, extra);
  }


  componentDidMount() {
    this.fetchToken();
    // tokens expire after 60 minutes, so automatically fetch a new one every 50 minutes
    // Not sure if this will work properly if a computer goes to sleep for > 50 minutes
    // and then wakes back up
    // react automatically binds the call to this
    // eslint-disable-next-line
    this.setState({ tokenInterval: setInterval(this.fetchToken, 50 * 60 * 1000) });
    this.fetchVoices();

    if (this.audioElementRef.current) {
      this.audioElementRef.current.addEventListener('play', this.onAudioLoaded);
      this.audioElementRef.current.addEventListener('error', this.handleAudioError);
    }
  }

  componentWillUnmount() {
    clearInterval(this.state.tokenInterval);
    if (this.audioElementRef.current) {
      this.audioElementRef.current.removeEventListener('play', this.onAudioLoaded);
      this.audioElementRef.current.removeEventListener('error', this.handleAudioError);
    }
  }

  fetchToken() {
    return fetch('/api/v1/credentials')
      .then((res) => {
        if (res.status !== 200) {
          throw new Error('Error retrieving auth token');
        }
        return res.json();
      }) // todo: throw here if non-200 status
      .then(creds => this.setState({ ...creds }))
      .catch(this.handleError);
  }

  fetchVoices() {
    return fetch('/api/v1/voices')
      .then((res) => {
        if (res.status !== 200) {
          throw new Error('Error retrieving voices');
        }
        return res.json();
      }) // todo: throw here if non-200 status
      .then(results => this.setState({ ...results }))
      .catch(this.handleError);
  }

  fetchTranslation(msgs, sayIt) {
    const params = this.setupParamsForTranslate([msgs]);
    return fetch(`/api/v1/translate?${params.toString()}`)
      .then((res) => {
        if (res.status !== 200) {
          throw new Error('Error retrieving translation');
        }
        return res.json();
        })
        .then((result) => {
          if (sayIt) {
            params.set('text', result.translated );
            params.set('download', true);
            if (canPlayAudioFormat('audio/mp3')) {
              params.set('accept', 'audio/mp3');
            } else if (canPlayAudioFormat('audio/ogg;codec=opus')) {
              params.set('accept', 'audio/ogg;codec=opus');
            } else if (canPlayAudioFormat('audio/wav')) {
              params.set('accept', 'audio/wav');
            }
            const audio = this.audioElementRef.current;
            audio.setAttribute('type', 'audio/ogg;codecs=opus');
            audio.setAttribute('src', `/api/v1/synthesize?${params.toString()}`);
            this.setState({loading: true, hasAudio: false});
          }
          return result;
        }) // todo: throw here if non-200 status
        .catch(this.handleError);
    }

  onAudioLoaded() {
    this.setState({ loading: false, hasAudio: true });
  }

  onSpeak(checked) {
    // console.log("Enable Text to Speech:", checked);
    this.setState({speaking: checked});
  }

  onModelChange(event) {
    this.reset();

    if (event.target.value === 'init') {
      return;
    }

    const model = this.state.models[this.state.models.map(m => m.name).indexOf(event.target.value)];
    const model_language = model.language.substring(0, 2);
    const model_targets = this.state.modelMap[model_language];

    // Set target voices based on source model, available translations map, and voices.
    this.state.target_voices = this.state.voices.filter(
      voice =>
        model_language === voice.language.substring(0, 2) || // same language (no translate)
        ( model_targets && model_targets.includes(voice.language.substring(0, 2)))).sort(
          function(a, b) { return a.language.localeCompare(b.language) || a.description.localeCompare(b.description); });

    this.setState({
      model,
      error: null,
      text: null,
    });

    if (this.state.target_voices && this.state.target_voices.length > 0) {
      if (this.state.voice && this.state.target_voices.map(v => v.name).indexOf(this.state.voice.name) >= 0) {
        // The pulldown keeps the existing voice name when it is there.
      } else {
        // The current voice is not in the list of targets anymore. Selection goes to the first one.
        this.state.voice = this.state.target_voices[0];
      }
    }
    else {
      this.state.voice = null;
    }

  }

  onVoiceChange(event) {

    this.state.voice = this.state.target_voices[this.state.target_voices.map(v => v.name).indexOf(event.target.value)];

    this.state.translatedMessages = [];
    this.state.translatedResults = [];
    this.setState({
      error: null,
      text: null,
    });

    if (this.state.translating) {
      this.doLanguageTranslation(true);
    }
  }

  setupParamsForTranslate(messages) {
    const { model, voice } = this.state;

    const transcript = messages.join(' ');

    const params = getSearchParams();
    params.set('text', transcript);
    params.set('source', model.language);
    params.set('voice', voice.name);
    return params;
  }

  setupParamsFromState(doDownload) {
    const { model, voice } = this.state;

    const messages = this.getFinalResults();

    const transcripts = [];
    for (let msg of messages) {
      transcripts.push(msg.results[0].alternatives[0].transcript);
    }
    const transcript = transcripts.join(' ');

    const params = getSearchParams();
    params.set('text', transcript);
    params.set('source', model.language);
    params.set('voice', voice.name);
    params.set('download', doDownload);

    if (canPlayAudioFormat('audio/mp3')) {
      params.set('accept', 'audio/mp3');
    } else if (canPlayAudioFormat('audio/ogg;codec=opus')) {
      params.set('accept', 'audio/ogg;codec=opus');
    } else if (canPlayAudioFormat('audio/wav')) {
      params.set('accept', 'audio/wav');
    }

    return params;
  }

  handleAudioError(error) {
    console.error(error);
    this.setState({ error: { error: 'Could not play audio' }, loading: false });
    setTimeout(() => this.setState({ error: null }), 5000);
  }

  render() {
    const {
      audioSource, target_voices, voice, models, model, error,
      formattedMessages, rawMessages, translatedResults, translating
    } = this.state;

    const messages = this.getFinalAndLatestInterimResult();
    const translatedTranscript = [];
    for (let i = 0; i < translatedResults.length; i += 1) {
      translatedTranscript.push({result_index: i, ...translatedResults[i]});
    }

    let transcribedText = '';
    let ttsCheckbox =
      <fieldset className="bx--fieldset">
        <Checkbox defaultChecked labelText="Enable Sentiment" onChange={this.onSpeak} id="checked" />
      </fieldset>;

    let audioRefError =
        <div className="output-container">
          <div className={`errorMessage ${error ? '' : 'hidden'}`}>
            <Icon type="error" />
            <p className="base--p service-error--message">
              {error ? error.error : ''}
            </p>
          </div>
          <audio ref={this.audioElementRef} autoPlay id="audio" className='hidden' controls="controls">
            Your browser does not support the audio element.
          </audio>
        </div>;

    let voice_name = null;
    if (voice) {
      voice_name = voice.name;
    } else if (target_voices && target_voices.length > 0) {
      voice_name = target_voices[0].name;
    }

    let outputVoices;
    let inputInit;
    let ltButton = '';
    let translatedText = '';

    if (target_voices === null) {
      // Only shows these when nothing has been selected yet.
      inputInit =
        <option key='init' value='init'>
          Select a speech recognition model...
        </option>;
      outputVoices =
        <select
          name="voice"
          className="base--select"
          onChange={this.onVoiceChange}
        >
          <option key='init' value='init'>
            Target voices are updated after you select a source language model.
          </option>
        </select>;
    } else {
      inputInit = '';
      transcribedText =
        <Tabs selected={0} >
          <Pane label="Transcribed">
            <Transcript messages={messages} />
          </Pane>
          <Pane label="JSON">
            <JSONView raw={rawMessages} formatted={formattedMessages} />
          </Pane>
        </Tabs>;

      if (target_voices.length === 0) {
        outputVoices =
          <select
            name="voice"
            className="base--select"
            onChange={this.onVoiceChange}
          >
            <option key='init' value='init'>
              No output voices available for {model.language}.
            </option>
          </select>;
      } else {

        // if (voice.language !== model.language) {
          if (translating) {
            ltButton =
              <button type="button" onClick={this.handleTranslateClick}>
                <Icon type='stop' fill={Colors.red_50} /> Loading Sentiment...
              </button>
          } else {
            ltButton =
              <button type="button" onClick={this.handleTranslateClick}>
                <Icon type='plus' fill={Colors.purple_50} /> Sentiment
              </button>
          }

          translatedText =
            <Tabs selected={0}>
              <Pane label="Sentiment Log">
                <Transcript messages={translatedTranscript} />
              </Pane>
            </Tabs>
        // }
        outputVoices =
          <select
            name="voice"
            className="base--select"
            onChange={this.onVoiceChange}
            value={voice_name}
          >
            {this.state.target_voices.map(v => (
              <option key={v.name} value={v.name}>
                [{v.language}]  {v.description}
              </option>
            ))}
          </select>;
      }
    }

    let audioButton;
    if (audioSource === 'mic') {
      audioButton =
        <button type="button" onClick={this.handleMicClick}>
          <Icon type='stop' fill={Colors.red_50} /> Stop Listening
        </button>
    } else {
      audioButton =
        <button type="button" onClick={this.handleMicClick}>
          <Icon type='microphone' fill={Colors.purple_50} /> Speak Here
        </button>
    }

    return (
      <section className="_container _container_large">
        <div className="row">
          <h1 className="base--h1 title">
            <b>Covid Symptom Log</b>
          </h1>
        </div>
        <div className="row">
          <h2 className="base--h2 title">
            Please select a language below:
          </h2>
          <div className="voice-input">
            <select
              name="model"
              className="base--select"
              onChange={this.onModelChange}
              value={model.name}
            >
              {inputInit}
              {models.map(m => (
                <option key={m.name} value={m.name}>
                  {m.description}
                </option>
              ))}
            </select>
          </div>
          <div className={`${inputInit === '' ? '' : 'hidden'}`}>
            {/* Everything in here is hidden until a voice recognition model is selected. */}
            <div className="flex buttons">
              {audioButton}
            </div>
            <div className="row">
              {transcribedText}
            </div>
            <div className="row">
              <h2 className="base--h2 title">
              {/* 
            Output Language and Voice:
            */}
              </h2>
              {/* <div className="voice-input">
                {outputVoices}
              </div> */}
              <div className="flex buttons">
                {ltButton}
                {ttsCheckbox}
                {translatedText}
                {audioRefError}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }
};
