import React from 'react';
import PropTypes from 'prop-types';
import {BrowserRouter as Router, Route, Switch, withRouter} from 'react-router-dom';

import Home from './home';
import Docs from './docs';
import About from './about';
import Contact from './contact';
import ConnectGitHubAccount from './connect-github-account';
import Sorry from './sorry';

export class Root extends React.Component {
  render() {
    return (
      <Router>
        <ScrollToTop>
          <Switch>
            <Route exact path="/" component={Home} />
            <Route path="/docs" component={Docs} />
            <Route path="/about" component={About} />
            <Route
              path="/terms"
              component={() => (
                <Sorry message="Resdir is still in an early stage of development, and legal issues have yet to be
                resolved." />
              )}
            />
            <Route
              path="/privacy"
              component={() => (
                <Sorry message="Resdir is still in an early stage of development, and privacy issues have yet to be
              resolved." />
              )}
            />
            <Route path="/contact" component={Contact} />
            <Route path="/connect-github-account/:token" component={ConnectGitHubAccount} />
            <Route component={() => <Sorry message="There's nothing at this address." />} />
          </Switch>
        </ScrollToTop>
      </Router>
    );
  }
}

@withRouter
class ScrollToTop extends React.Component {
  static propTypes = {
    location: PropTypes.object.isRequired,
    children: PropTypes.node.isRequired
  };

  componentDidUpdate(prevProps) {
    if (this.props.location !== prevProps.location) {
      window.scrollTo(0, 0);
    }
  }

  render() {
    return this.props.children;
  }
}

export default Root;
