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

import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { JsonInline } from './json-inline.jsx';

function makeJsonLink(obj, i) {
  return (obj ? <JsonInline json={obj} key={`jsonlink-${i}`} /> : null);
}

// we want to insert nulls into the array rather than remove the elements so that the non-null
// items will have the same key
function nullInterim(msg) {
  if (msg.speaker_labels) {
    // some messages can have both results (final or interim) and speaker labels
    // in that case we want to show it for the speaker_labels, even if the result is interim
    return msg;
  }
  if (msg.results && msg.results.length && !msg.results[0].final) {
    return null;
  }
  return msg;
}

export class JsonView extends Component {
  constructor() {
    super();
  }

  render() {
    try {
      let output = this.props.formatted.map(nullInterim).map(makeJsonLink);

      return (
        <div className="jsonview">
          <div className="results">
            {output}
          </div>
        </div>
      );
    } catch (ex) {
      console.log(ex);
      return <div>{ex.message}</div>;
    }
  }
};

JsonView.propTypes = {
  raw: PropTypes.array.isRequired,
  formatted: PropTypes.array.isRequired,
};

export default JsonView;
