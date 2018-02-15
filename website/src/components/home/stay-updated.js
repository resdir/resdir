import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter, Form, Input, Button} from 'radium-starter';

import {getRegistryServer} from '../../registry-server';
import {getModal} from '../../modal';
import {withErrorBoundary, catchErrors} from '../error-boundary';
import Spinner from '../spinner';

@withErrorBoundary
@withRadiumStarter
export class StayUpdated extends React.Component {
  static propTypes = {
    id: PropTypes.string,
    style: PropTypes.object,
    styles: PropTypes.object.isRequired
  };

  state = {
    email: '',
    isSubmitting: false,
    hasBeenSubmitted: false
  };

  @catchErrors
  async submit() {
    const email = this.state.email;
    const registryServer = await getRegistryServer();
    try {
      this.setState({isSubmitting: true});
      await registryServer.subscribeToNewsletter({email});
      this.setState({hasBeenSubmitted: true});
    } catch (err) {
      const knownErrors = {
        INVALID_EMAIL_ADDRESS: 'This email address appears to be invalid.',
        INVALID_EMAIL_DOMAIN: 'The domain part of this email address appears to be invalid.',
        DISPOSABLE_EMAIL_ADDRESS: 'Please use a real email address (not a disposable one).'
      };
      const message = knownErrors[err.code] || 'An unknown error occurred.';
      await getModal().alert(message, {title: 'Oups'});
    } finally {
      this.setState({isSubmitting: false});
    }
  }

  render() {
    const {id, style, styles: s} = this.props;

    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '1.5rem',
      ...style
    };

    if (this.state.isSubmitting) {
      return (
        <div id={id} style={containerStyle}>
          <Spinner size={50} />
        </div>
      );
    }

    if (this.state.hasBeenSubmitted) {
      return (
        <div id={id} style={containerStyle}>
          <h2>Thank you</h2>
          <h4 style={{...s.subheading, marginBottom: '2rem', textAlign: 'center'}}>
            We'll keep you informed.
          </h4>
        </div>
      );
    }

    return (
      <div id={id} style={containerStyle}>
        <h2>Stay updated</h2>
        <h4 style={{...s.subheading, marginBottom: '2rem', textAlign: 'center'}}>
          Know when Resdir is ready for production – and everything else.
        </h4>
        {/* eslint-disable no-script-url */}
        <Form
          onSubmit={e => {
            e.preventDefault();
            this.submit();
          }}
          action="javascript:void(0)"
          style={{display: 'flex', alignItems: 'center'}}
        >
          {/* eslint-enable no-script-url */}
          <Input
            type="email"
            onChange={e => {
              this.setState({email: e.target.value});
            }}
            value={this.state.email}
            required
            rsLarge
            placeholder="Your email address"
            style={{width: '300px', marginRight: '0.75rem'}}
          />
          <Button type="submit" rsPrimary rsLarge>
            I'm in!
          </Button>
        </Form>
      </div>
    );
  }
}

export default StayUpdated;
