import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter} from 'radium-starter';

import Link from '../link';

@withRadiumStarter
export class Home extends React.Component {
  static propTypes = {
    to: PropTypes.string.isRequired,
    theme: PropTypes.object.isRequired,
    styles: PropTypes.object.isRequired
  };

  render() {
    const {to, theme: t, styles: s} = this.props;

    return (
      <div style={{...s.minimumLineHeight, alignSelf: 'center', padding: '1.5rem 0'}}>
        <Link to={'#' + to} style={{color: t.mutedTextColor, ':hover': {textDecoration: 'none'}}}>
          ▼
        </Link>
      </div>
    );
  }
}

export default Home;
