import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter, Button} from 'radium-starter';

@withRadiumStarter
export class Action extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    styles: PropTypes.object.isRequired
  };

  render() {
    const {style, styles: s} = this.props;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '4.5rem 1rem 5.5rem 1rem',
          ...style
        }}
      >
        <h3
          style={{
            ...s.subheading,
            marginBottom: '2rem',
            textAlign: 'center',
            maxWidth: '970px'
          }}
        >
          You've only seen a small glimpse of what @resources can do, to really understand how great
          they are, the best is to create one.
        </h3>
        <Button rsAccent rsLarge>
          Create your first @resource
        </Button>
      </div>
    );
  }
}

export default Action;
