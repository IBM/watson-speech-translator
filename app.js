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

const express = require('express');
const bodyParser = require('body-parser');

const app = express();

const vcapServices = require('vcap_services');

const LanguageTranslatorV3 = require('ibm-watson/language-translator/v3');
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1.js');
const TextToSpeechV1 = require('ibm-watson/text-to-speech/v1.js');

const { IamTokenManager } = require('ibm-watson/auth');
const { Cp4dTokenManager } = require('ibm-watson/auth');

const axios = require('axios').default;

let sttUrl = process.env.SPEECH_TO_TEXT_URL;

// Ensure we have a SPEECH_TO_TEXT_AUTH_TYPE so we can get a token for the UI.
let sttAuthType = process.env.SPEECH_TO_TEXT_AUTH_TYPE;
if (!sttAuthType) {
  sttAuthType = 'iam';
} else {
  sttAuthType = sttAuthType.toLowerCase();
}
// Get a token manager for IAM or CP4D.
let tokenManager = false;
if (sttAuthType === 'cp4d') {
  tokenManager = new Cp4dTokenManager({
    username: process.env.SPEECH_TO_TEXT_USERNAME,
    password: process.env.SPEECH_TO_TEXT_PASSWORD,
    url: process.env.SPEECH_TO_TEXT_AUTH_URL,
    disableSslVerification: process.env.SPEECH_TO_TEXT_AUTH_DISABLE_SSL || false
  });
} else if (sttAuthType === 'iam') {
  let apikey = process.env.SPEECH_TO_TEXT_APIKEY;
  if (!(apikey && sttUrl)) {
    // If no runtime env override for both, then try VCAP_SERVICES.
    const vcapCredentials = vcapServices.getCredentials('speech_to_text');
    // Env override still takes precedence.
    apikey = apikey || vcapCredentials.apikey;
    sttUrl = sttUrl || vcapCredentials.url;
  }
  tokenManager = new IamTokenManager({ apikey });
} else if (sttAuthType === 'bearertoken') {
  console.log('SPEECH_TO_TEXT_AUTH_TYPE=bearertoken is for dev use only.');
} else {
  console.log('SPEECH_TO_TEXT_AUTH_TYPE =', sttAuthType);
  console.log('SPEECH_TO_TEXT_AUTH_TYPE is not recognized.');
}

// Init the APIs using environment-defined auth (default behavior).
const speechToText = new SpeechToTextV1({ version: '2019-12-16' });
const textToSpeech = new TextToSpeechV1({ version: '2019-12-16' });

// Optional Language Translator
let languageTranslator = false;
try {
  languageTranslator = new LanguageTranslatorV3({ version: '2019-12-16' });
} catch (err) {
  console.log('Watson LT Error:', err.toString());
  console.log('Continuing w/o Watson LT');
}

// Alternate Language Translator (only if no Watson LT)
let altLanguageTranslator = false;
let altLTUrl = false;

if (!languageTranslator) {
  altLTUrl = process.env.LINGVANEX_URL;
  if (altLTUrl) {
    altLanguageTranslator = true;
  }
}

let modelFilter = parseInt(process.env.SPEECH_TO_TEXT_MODEL_FILTER, 10);
if (Number.isNaN(modelFilter) === true) {
  modelFilter = 8000;
}

// Get supported source language for Speech to Text
let speechModels = [];
speechToText
  .listModels()
  .then(response => {
    speechModels = response.result.models; // The whole list
    console.log('STT MODEL FILTER: ', modelFilter);
    console.log('STT MODELS (before filter): ', speechModels);
    // Filter to only show one band.
    speechModels = response.result.models.filter(model => model.rate > modelFilter);
    // Make description be `[lang] description` so the sort-by-lang makes sense.
    speechModels = speechModels.map(m => ({ ...m, description: `[${m.language}]  ${m.description}` }));
    speechModels.sort(function(a, b) {  // eslint-disable-line
      // Sort by 1 - language, 2 - description.
      return a.language.localeCompare(b.language) || a.description.localeCompare(b.description);
    });
  })
  .catch(err => {
    console.log('error: ', err);
  });

// Get supported language translation targets
const modelMap = {};
const altLangs = {};

if (languageTranslator) {
  languageTranslator
    .listModels()
    .then(response => {
      for (const model of response.result.models) {  // eslint-disable-line
        const { source, target } = model;
        if (!(source in modelMap)) {
          modelMap[source] = new Set([target]);
        } else {
          modelMap[source].add(target);
        }
      }
      // Turn Sets into arrays.
      for (const k in modelMap) {  // eslint-disable-line
        modelMap[k] = Array.from(modelMap[k]);
      }
    })
    .catch(err => {
      console.log('error: ', err);
    });
} else if (altLanguageTranslator) {
  const getLanguagesUrl = `${altLTUrl}/get-languages`;
  console.log('GET MODELS FROM: ', getLanguagesUrl);

  axios.get(getLanguagesUrl).then(function(response) {
    console.log('GET LANGUAGES RESPONSE: ', response.data);
    let langs = new Set();
        for (const l in response.data) {  // eslint-disable-line
      console.log('LANG: ', response.data[l]);
      langs.add(response.data[l].code_alpha_1); // collect list of langs
    }
    langs = Array.from(langs);
        for (const l in response.data) {  // eslint-disable-line
      modelMap[response.data[l].code_alpha_1] = langs; // anything-to-anything
      altLangs[response.data[l].code_alpha_1] = response.data[l].codeName;
    }
    console.log('MODEL MAP: ', modelMap);
  });
}

let voiceFilter = process.env.TEXT_TO_SPEECH_VOICE_FILTER;
if (typeof voiceFilter === 'undefined') {
  voiceFilter = 'V3';
}

// Get supported source language for Speech to Text
let voices = [];
textToSpeech
  .listVoices()
  .then(response => {
    console.log('TTS VOICE FILTER: ', voiceFilter);
    console.log('TTS VOICES (before filter): ', response.result.voices);
    // There are many redundant voices. For now the V3 ones are the best ones.
    voices = response.result.voices.filter(voice => voice.name.includes(voiceFilter));
  })
  .catch(err => {
    console.log('error: ', err);
  });

// Bootstrap application settings
require('./config/express')(app);

const getFileExtension = acceptQuery => {
  const accept = acceptQuery || '';
  switch (accept) {
    case 'audio/ogg;codecs=opus':
    case 'audio/ogg;codecs=vorbis':
      return 'ogg';
    case 'audio/wav':
      return 'wav';
    case 'audio/mpeg':
      return 'mpeg';
    case 'audio/webm':
      return 'webm';
    case 'audio/flac':
      return 'flac';
    default:
      return 'mp3';
  }
};

app.get('/', (req, res) => {
  res.render('index');
});

// Get credentials using your credentials
app.get('/api/v1/credentials', async (req, res, next) => {
  if (tokenManager) {
    try {
      const accessToken = await tokenManager.getToken();
      res.json({
        accessToken,
        serviceUrl: sttUrl
      });
    } catch (err) {
      console.log('Error:', err);
      next(err);
    }
  } else if (process.env.SPEECH_TO_TEXT_BEARER_TOKEN) {
    res.json({
      accessToken: process.env.SPEECH_TO_TEXT_BEARER_TOKEN,
      serviceUrl: sttUrl
    });
  } else {
    console.log('Failed to get a tokenManager or a bearertoken.');
  }
});

/**
 * Language Translator
 */
app.get('/api/v1/translate', async (req, res) => {
  const inputText = req.query.text;

  const ltParams = {
    text: inputText,
    source: req.query.source.substring(0, 2),
    target: req.query.voice.substring(0, 2)
  };

  const doTranslate = languageTranslator && ltParams.source !== ltParams.target;

  try {
    // Use language translator only when source language is not equal target language
    if (doTranslate) {
      const ltResult = await languageTranslator.translate(ltParams);
      req.query.text = ltResult.result.translations[0].translation;
      console.log('TRANSLATED:', inputText, ' --->', req.query.text);
    } else if (altLanguageTranslator) {
      ltParams.q = ltParams.text;
      ltParams.platform = 'api';

      console.log('TRY ALT TRANSLATOR AT: ', altLTUrl);
      const body = ltParams;
      const response = await axios({
        method: 'post',
        url: `${altLTUrl}/translate`,
        data: body,
        headers: { accept: 'application/json', 'content-type': 'application/json' }
      });
      const data = await response.data;
      console.log('RESPONSE: ', data);
      req.query.text = data.translatedText;
    } else {
      // Same language, skip LT, use input text.
      console.log('TRANSLATION SKIPPED:', inputText);
      req.query.text = inputText;
    }

    res.json({ translated: req.query.text });
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});

/**
 * Fake Language Translator endpoint for testing -- just toUpper()
 */
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/api/v1/upper', async (req, res) => {
  console.log('IN UPPER         -->', req.body);
  const inputText = req.body.q;
  try {
    req.query.text = inputText.toUpperCase();
    console.log('TRANSLATED TO UPPER:', inputText, ' --> ', req.query.text);
    res.json({ translated: req.query.text });
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});

/**
 * Pipe the synthesize method
 */
app.get('/api/v1/synthesize', async (req, res, next) => {
  try {
    console.log('TEXT-TO-SPEECH:', req.query.text);
    const { result } = await textToSpeech.synthesize(req.query);
    const transcript = result;
    transcript.on('response', response => {
      if (req.query.download) {
        response.headers['content-disposition'] = `attachment; filename=transcript.${getFileExtension(req.query.accept)}`;
      }
    });
    transcript.on('error', next);
    transcript.pipe(res);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});

// Return the models, voices, and supported translations.
app.get('/api/v1/voices', async (req, res, next) => {
  try {
    // Add languages w/o voices (specifically for alternate translators)
    for (const i in altLangs) {  // eslint-disable-line
      if (voices.filter(voice => i === voice.language.substring(0, 2)).length < 1) {
        // if this alt lang is not in voices, add a voice-less entry.
        voices.push({
          name: i,
          description: `${altLangs[i]} translation without voice.`,
          language: i,
          url: '' // NO TTS URL!
        });
      }
    }

    res.json({
      modelMap,
      models: speechModels,
      voices
    });
  } catch (error) {
    next(error);
  }
});

// error-handler settings
require('./config/error-handler')(app);

module.exports = app;
