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

import { JsonLinkInline } from 'watson-react-components';
import React, { Component } from 'react';
import PropTypes from 'prop-types';

export class JsonInline extends Component {
  constructor(props) {
    super(); // Or else everything breaks

    const json = JSON.stringify(props.json);
    // space after commas to help browsers decide where breakpoints should go on small screens
    const description = (json.length <= 78)
      ? json
      : `${json.substr(0, 14)} ...${json.substr(-60).replace(/,/g, ', ')}`;

    this.state = {
      showJson: false,
      description,
    };

    // What we want most of the time.
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    this.setState(prevState => ({ showJson: !prevState.showJson }));
  }

  render() {
    const { json } = this.props;
    const { description, showJson } = this.state;

    return (
      <JsonLinkInline
        json={json}
        description={<code>{description}</code>}
        showJson={showJson}
        onShow={this.handleClick}
      />
    );
  }
}

JsonInline.propTypes = {
  json: PropTypes.object.isRequired, // eslint-disable-line
};

export default JsonInline;
