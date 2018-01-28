import React from 'react';
import PropTypes from 'prop-types';

const RESDIR_LOGO_PATH = '/images/resdir-logo-v1.immutable.svg'; // WARNING: this path is repeated in index.html

export class Logo extends React.Component {
  static propTypes = {
    width: PropTypes.number.isRequired
  };

  render() {
    return (
      <img
        src={RESDIR_LOGO_PATH}
        alt="Resdir"
        style={{
          width: this.props.width + 'px',
          height: this.props.width * 0.338624338624339 + 'px'
        }}
      />
    );
  }
}

export default Logo;
