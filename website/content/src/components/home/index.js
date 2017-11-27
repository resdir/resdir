import React from 'react';
import {RadiumStarter} from 'radium-starter';

import Header from '../header';
import Hero from './hero';
import Intro from './intro';
import Demo from './demo';
import Action from './action';
import Footer from '../footer';
import Link from '../link';
import FullHeight from '../full-height';
import ErrorBoundary from '../error-boundary';

@ErrorBoundary
@RadiumStarter
export class Home extends React.Component {
  render() {
    const t = this.theme;
    const s = this.styles;

    return (
      <div>
        <FullHeight style={{backgroundColor: t.screenColor}}>
          <Header />
          <Hero style={{flexGrow: 1}} />
          <div style={[s.minimumLineHeight, {alignSelf: 'center', padding: '1.5rem 0'}]}>
            <Link to="/#intro" style={[s.primaryColor, {':hover': {textDecoration: 'none'}}]}>
              ▼
            </Link>
          </div>
        </FullHeight>
        <div style={s.centeredPage}>
          <Intro />
          <hr style={{marginTop: 0, marginBottom: 0}} />
          <Demo />
          <hr style={{marginTop: 0, marginBottom: 0}} />
          <Action />
        </div>
        <Footer />
      </div>
    );
  }
}

export default Home;
