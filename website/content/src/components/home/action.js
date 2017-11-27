import React from 'react';
import PropTypes from 'prop-types';
import {RadiumStarter, Button} from 'radium-starter';

@RadiumStarter
export class Action extends React.Component {
  static propTypes = {
    style: PropTypes.object
  };

  render() {
    // const t = this.theme;
    const s = this.styles;

    return (
      <div
        style={[
          this.props.style,
          {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '4.5rem 1rem 5.5rem 1rem'
          }
        ]}
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
