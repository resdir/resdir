import React from 'react';
import PropTypes from 'prop-types';
import {withRadiumStarter} from 'radium-starter';

import Layout from './layout';
import Link from './link';
import withErrorBoundary from './error-boundary';

@withErrorBoundary
@withRadiumStarter
export class About extends React.Component {
  static propTypes = {
    theme: PropTypes.object.isRequired
  };

  render() {
    const {theme: t} = this.props;

    return (
      <Layout style={{justifyContent: 'center', alignItems: 'center', padding: '1.5rem 1.5rem'}}>
        <div>
          <h3>About</h3>
          <p style={{maxWidth: '600px', lineHeight: t.modularScale(3, 1)}}>
            Resdir is the main (and unique) project of <a href="https://1place.io">1Place Inc.</a>,
            a company founded in July&nbsp;2016 in Fukuoka, Japan. The initial plan had nothing to
            do with Resdir, and before starting the actual work, Manuel Vila (founder and presently
            the only member of the company) took great care in choosing his development tools.
            Unfortunately, no tool was satisfying, Manuel felt like something was going wrong.
            Whether it was installation, customization or composition, the developer experience was
            not good. Manuel has then dug, dug and dug to finally come up with the idea of{' '}
            <Link to="/#intro">@resources</Link>. It was so exciting that he put aside his initial
            plan to make this @resource concept a reality. This is how Resdir was born.
          </p>
        </div>
      </Layout>
    );
  }
}

export default About;
