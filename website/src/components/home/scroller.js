import React from 'react';
import PropTypes from 'prop-types';
import RadiumStarter from 'radium-starter';

import Link from '../link';

export class Home extends React.Component {
  static propTypes = {
    to: PropTypes.string.isRequired
  };

  render() {
    return (
      <RadiumStarter>
        {(t, s) => {
          const {to} = this.props;

          return (
            <div style={{...s.minimumLineHeight, alignSelf: 'center', padding: '1.5rem 0'}}>
              <Link
                to={'#' + to}
                style={{color: t.mutedTextColor, ':hover': {textDecoration: 'none'}}}
              >
                ▼
              </Link>
            </div>
          );
        }}
      </RadiumStarter>
    );
  }
}

export default Home;
