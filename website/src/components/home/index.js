import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter} from 'radium-starter';

import Header from '../header';
import Footer from '../footer';
import FullHeight from '../full-height';
import Hero from './hero';
import Scroller from './scroller';
import StayUpdated from './stay-updated';

@withRadiumStarter
export class Home extends React.Component {
  static propTypes = {
    theme: PropTypes.object.isRequired,
    styles: PropTypes.object.isRequired
  };

  render() {
    const {theme: t} = this.props;

    return (
      <div>
        <FullHeight style={{backgroundColor: t.altBackgroundColor}}>
          <Header />
          <Hero style={{flexGrow: 1}} />
          <Scroller to="stay-updated" />
        </FullHeight>
        <FullHeight>
          <StayUpdated id="stay-updated" style={{flexGrow: 1}} />
          <Footer />
        </FullHeight>
      </div>
    );
  }
}

export default Home;
