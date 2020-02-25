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

import React from 'react';
import PropTypes from 'prop-types';
import { Header, Jumbotron } from 'watson-react-components';

// eslint-disable-next-line
const DESCRIPTION = 'This web app demonstrates Watson Speech to Text, Language Translator and Text to Speech.';

function Layout(props) {
  const { children } = props;
  return (
    <html lang="en">
      <head>
        <title>
          Speech Translator with Watson
        </title>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="og:title" content="Speech Translator with Watson" />
        <meta name="og:description" content={DESCRIPTION} />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-icon-180x180.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/images/android-icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/images/favicon-96x96.png" />
        <link rel="icon" type="image/x-icon" href="/images/favicon.ico" />
        <link rel="stylesheet" href="/css/watson-react-components.min.css" />
        <link rel="stylesheet" href="/css/style.css" />
      </head>
      <body>
        <Header
          // TODO: Using voice-bot as place-holder. Need final Repo/Page URL if keeping this header.
          mainBreadcrumbs="Code Pattern Page"
          mainBreadcrumbsUrl="https://developer.ibm.com/technologies/artificial-intelligence/patterns/build-a-real-time-translation-service-with-watson-api-kit"
          subBreadcrumbs="GitHub Repo"
          subBreadcrumbsUrl="https://github.com/IBM/watson-speech-translator"
        />
        <div id="root">
          {children}
        </div>
        <script type="text/javascript" src="js/bundle.js" />
      </body>
    </html>
  );
}

Layout.propTypes = {
  children: PropTypes.object.isRequired, // eslint-disable-line
};

export default Layout;
