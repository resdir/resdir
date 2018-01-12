import React from 'react';
import PropTypes from 'prop-types';
import {Style} from 'radium';
import {withRadiumStarter} from 'radium-starter';

import Markdown from '../markdown';

const BODY = `
### Hello, @resources!

A @resource is a new kind of document allowing to describe almost anything: tools, APIs, configs, libraries,... Embracing the principles of object-oriented programming, @resources are composed of attributes and methods, and they can inherit from each other.

For example, here is a @resource describing a website hosted by AWS:

\`\`\`
{
  "frontend": {
    "@import": "aws/website",
    "domainName": "www.example.com"
  },
  "backend": {
    "@import": "aws/hosted-resource",
    "domainName": "api.example.com",
    "@export": {
      "hello": { "@type": "method" }
    }
  }
}
\`\`\`

Our @resource is composed of two sub-@resources: \`"frontend"\` which inherits from \`"aws/website"\`, and \`"backend"\` which inherits from \`"aws/hosted-resource"\`. An exciting feature of @resources is that they can be invoked remotely. By inheriting from \`"aws/hosted-resource"\`, the backend will run on AWS Lambda.

Here is the implementation of the frontend:

\`\`\`
<!DOCTYPE html>
<html>
  <body>
    <script src="https://unpkg.com/run-core@^0.11/um/run-core.js"></script>
    <script>
      (async () => {
        const backend = await Resource.$import('https://api.example.com');
        document.body.innerText = await backend.hello();
      })();
    </script>
  </body>
</html>
\`\`\`

Once the backend has been imported with \`Resource.$import()\`, the \`hello()\` method is available in the browser, and although it runs on the server side, it can be invoked as if it were defined locally.

And here is the implementation of the backend which is pretty straightforward:

\`\`\`
export default base =>
  class Backend extends base {
    async hello() {
      return 'Hello, @resources!';
    }
  };
\`\`\`

Finally, we can use \`run\` (the @resource runtime) to interact with the @resource. Deploying our website to AWS is as simple as:

\`\`\`
$ run frontend deploy && run backend deploy
\`\`\`

Voilà! Our website is online. With minimal effort, the frontend is served by S3 and CloudFront, the backend runs in Lambda, domain names are managed by Route 53, and SSL certificates have been created by ACM.

This example used two popular @resources, \`"aws/website"\` and \`"aws/hosted-resource"\`, but Resdir is not limited to that. A growing number of @resources are available, and if your favorite tools or services do not exist yet, it is up to you to implement your @resources and share them with everybody!
`;

const ASIDE = `
##### @Resource directory

Once a @resource has been carefully crafted, you can publish it to Resdir and share it to everyone (or to a selected group of people if your @resource is private).

@Resource's names are always prefixed with a namespace (e.g., \`"aturing/nice-tool"\`) so that there is no name conflict. When you create a Resdir account, you automatically get a personal namespace. It is also possible to create organizations or communities with their own namespace.

---

##### Language agnostic

For now, @resource's methods must be implemented in JavaScript because \`run\` (the first @resource runtime) knows only about this language. But more runtimes will soon be available, and with the \`"@runtime"\` attribute it will be possible to specify which runtime a @resource should use.

This will open up exciting possibilities for composing @resources based on different languages. For example, it will be possible to implement a @resource in Ruby while inheriting another one written in Go.

---

##### Automatic installations

All @resources have a built-in \`@install\` command, but you will almost never use it. As soon as you reference a @resource, the runtime takes care of downloading, installing and storing it in a global cache.

Also, the runtime regularly checks installed @resources and automatically updates them when a new version is available (according to your [Semantic Versioning](http://semver.org/) specifications).

Finally, multiple versions of the same @resource can be used concurrently, no more version conflicts!

---

##### High flexibility

Thanks to the object-oriented nature of @resources, everything is highly configurable and composable.

You can add attributes or overload methods, compose rich @resources by aggregating several sub-@resources together, create custom @resources by inheriting from existing ones, etc.
`;

@withRadiumStarter
export class Intro extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    theme: PropTypes.object.isRequired
  };

  render() {
    const {style, theme: t} = this.props;

    return (
      <div
        id="intro"
        style={{
          display: 'flex',
          alignItems: 'baseline',
          padding: '4.5rem 1.5rem',
          ...style,
          [`@media (max-width: ${t.mediumBreakpointMinusOne})`]: {
            flexDirection: 'column'
          }
        }}
      >
        <div className="intro-main" style={{flex: 2}}>
          <Style scopeSelector=".intro-main" rules={{h3: {color: t.accentColor}}} />
          <Markdown>{BODY}</Markdown>
        </div>

        <div
          style={{
            flex: 1,
            marginLeft: '3rem',
            [`@media (max-width: ${t.mediumBreakpointMinusOne})`]: {
              marginLeft: 0
            }
          }}
        >
          <Markdown>{ASIDE}</Markdown>
        </div>
      </div>
    );
  }
}

export default Intro;
