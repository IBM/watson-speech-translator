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

const app = express();

const sdkCore = require('ibm-cloud-sdk-core');

const AuthorizationV1 = require('ibm-watson/authorization/v1');
const LanguageTranslatorV3 = require('ibm-watson/language-translator/v3');
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1.js');
const TextToSpeechV1 = require('ibm-watson/text-to-speech/v1.js');

const { IamTokenManager } = require('ibm-watson/auth');
const { Cp4dTokenManager } = require('ibm-watson/auth');

// Ensure we have a SPEECH_TO_TEXT_AUTH_TYPE so we can get a token for the UI.
let sttAuthType =  process.env.SPEECH_TO_TEXT_AUTH_TYPE;
if (!sttAuthType) {
  sttAuthType = "iam";
} else {
  sttAuthType = sttAuthType.toLowerCase();
}
// Get a token manager for IAM or CP4D.
let tokenManager = false;
if (sttAuthType === 'cp4d') {
  tokenManager =
    new Cp4dTokenManager({
      username: process.env.SPEECH_TO_TEXT_USERNAME,
      password: process.env.SPEECH_TO_TEXT_PASSWORD,
      url: process.env.SPEECH_TO_TEXT_AUTH_URL,
      disableSslVerification: process.env.SPEECH_TO_TEXT_AUTH_DISABLE_SSL || false
    });
} else if (sttAuthType === 'iam') {
  tokenManager = new IamTokenManager({ apikey: process.env.SPEECH_TO_TEXT_APIKEY, });
} else if (sttAuthType === 'bearertoken') {
  console.log("SPEECH_TO_TEXT_AUTH_TYPE=bearertoken is for dev use only.");
} else {
  console.log("SPEECH_TO_TEXT_AUTH_TYPE =", sttAuthType);
  console.log("SPEECH_TO_TEXT_AUTH_TYPE is not recognized.");
}
const sttAuthenticator = sdkCore.getAuthenticatorFromEnvironment('speech-to-text');

// Init the APIs using environment-defined auth (default behavior).
const speechToText = new SpeechToTextV1({ version: '2019-12-16' });
const languageTranslator = new LanguageTranslatorV3({ version: '2019-12-16' });
const textToSpeech = new TextToSpeechV1({ version: '2019-12-16' });

// Get supported source language for Speech to Text
let speechModels = [];
speechToText.listModels()
  .then(response => {
    speechModels = response.result.models; // The whole list
    // Filter to only show one band.
    speechModels = response.result.models.filter(model => model.rate > 8000);  // TODO: Make it a .env setting
    // Make description be `[lang] description` so the sort-by-lang makes sense.
    speechModels = speechModels.map(m => ({ ...m, description: `[${m.language}]  ${m.description}`}));
    speechModels.sort(function(a, b) {
      // Sort by 1 - language, 2 - description.
      return a.language.localeCompare(b.language) || a.description.localeCompare(b.description);
    });
  })
  .catch(err => {
    console.log('error: ', err);
  });

// Get supported language translation targets
const modelMap = {};
languageTranslator.listModels()
  .then(response => {
    for (let model of response.result.models) {
      const { source, target } = model;
      if (!(source in modelMap)) {
        modelMap[source] = new Set([target]);
      }
      else {
        modelMap[source].add(target);
      }
    }
    // Turn Sets into arrays.
    for (let k in modelMap) {
      modelMap[k] = Array.from(modelMap[k]);
    }
  })
  .catch(err => {
    console.log('error: ', err);
  });

// Get supported source language for Speech to Text
let voices = [];
textToSpeech.listVoices()
  .then(response => {
    // There are many redundant voices. For now the V3 ones are the best ones.
    voices = response.result.voices.filter(voice => voice.name.includes('V3'));  // TODO: env param.
  })
  .catch(err => {
    console.log('error: ', err);
  });

// Bootstrap application settings
require('./config/express')(app);

const getFileExtension = (acceptQuery) => {
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


const sttUrl = process.env.SPEECH_TO_TEXT_URL || SpeechToTextV1.URL;

// Get credentials using your credentials
app.get('/api/v1/credentials', async (req, res, next) => {

  if (tokenManager) {
    try {
      const accessToken = await tokenManager.getToken();
      res.json({
        accessToken,
        serviceUrl: sttUrl,
      });
    } catch (err) {
      console.log("Error:", err);
      next(err);
    }
  } else if (process.env.SPEECH_TO_TEXT_BEARER_TOKEN) {
    res.json({
      accessToken: process.env.SPEECH_TO_TEXT_BEARER_TOKEN,
      serviceUrl: sttUrl,
    });
  } else {
    console.log("Failed to get a tokenManager or a bearertoken.");
  }
});

/**
 * Language Translator
 */
app.get('/api/v1/translate', async (req, res, next) => {

  const inputText = req.query.text;

  const ltParams = {
    text: inputText,
    source: req.query.source.substring(0, 2),
    target: req.query.voice.substring(0, 2),
  };

  const doTranslate = ltParams.source !== ltParams.target;

  try {

    // Use language translator only when source language is not equal target language
    if (doTranslate) {
      let ltResult = await languageTranslator.translate(ltParams);
      req.query.text = ltResult.result.translations[0].translation;
    } else {
      // Same language, skip LT, use input text.
      req.query.text = inputText
    }

    console.log("TRANSLATED:", inputText, ' --->', req.query.text);
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

    console.log("TEXT-TO-SPEECH:", req.query.text);
    const { result } = await textToSpeech.synthesize(req.query);
    const transcript = result;
    transcript.on('response', (response) => {
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
    res.json({
      modelMap: modelMap,
      models: speechModels,
      voices: voices
    });
  } catch (error) {
    next(error);
  }
});

// error-handler settings
require('./config/error-handler')(app);

module.exports = app;
