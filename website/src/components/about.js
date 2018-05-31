import React from 'react';
import RadiumStarter from 'radium-starter';

import constants from '../constants';
import Layout from './layout';
import withErrorBoundary from './error-boundary';

@withErrorBoundary
export class About extends React.Component {
  render() {
    return (
      <RadiumStarter>
        {t => {
          return (
            <Layout
              style={{justifyContent: 'center', alignItems: 'center', padding: '1.5rem 1.5rem'}}
            >
              <div>
                <h3>About</h3>
                <p style={{maxWidth: '600px', lineHeight: t.modularScale(3, 1)}}>
                  Resdir is the primary project of <a href="https://1place.io">1Place Inc.</a>, a
                  company founded in July&nbsp;2016 in Fukuoka, Japan. The initial plan had nothing
                  to do with Resdir, and before starting the actual work, Manuel Vila (founder and
                  presently the only member of the company) took great care in choosing his
                  development tools. Unfortunately, nothing was satisfying, and Manuel felt like
                  something was going wrong. Whether it was installation or configuration, the
                  developer experience was not good. Manuel has then dug, dug, and dug to finally
                  come up with the idea of{' '}
                  <a href={constants.RUN_WEBSITE_URL + '/docs/introduction/what-is-a-resource'}>
                    resources
                  </a>. It was so exciting that he put aside his initial plan to make this resource
                  concept a reality. That is how Resdir was born.
                </p>
              </div>
            </Layout>
          );
        }}
      </RadiumStarter>
    );
  }
}

export default About;
