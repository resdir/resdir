import React from 'react';
import RadiumStarter from 'radium-starter';

import Header from '../header';
import Footer from '../footer';
import FullHeight from '../full-height';
import Hero from './hero';
import Scroller from './scroller';
import StayUpdated from './stay-updated';

export class Home extends React.Component {
  render() {
    return (
      <RadiumStarter>
        {t => {
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
        }}
      </RadiumStarter>
    );
  }
}

export default Home;
