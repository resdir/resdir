import React from 'react';
import PropTypes from 'prop-types';

import Sorry from './sorry';

export function ErrorBoundary(WrappedComponent) {
  return class ErrorBoundary extends React.Component {
    static propTypes = {
      children: PropTypes.node.isRequired
    };

    state = {
      caughtError: undefined
    };

    componentWillReceiveProps() {
      this.setState({caughtError: undefined});
    }

    componentDidCatch(error, _info) {
      this.setState({caughtError: error});
    }

    render() {
      if (this.state.caughtError) {
        return <Sorry message="I'm afraid something went wrong." />;
      }
      return <WrappedComponent {...this.props} />;
    }
  };
}

export function errorBoundary(target, name, descriptor) {
  const original = descriptor.value;
  descriptor.value = async function (...args) {
    try {
      return await original.apply(this, args);
    } catch (err) {
      this.setState(() => {
        throw err;
      });
    }
  };
}

export default ErrorBoundary;
