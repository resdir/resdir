import React from 'react';
import PropTypes from 'prop-types';
import {RadiumStarter} from 'radium-starter';
import {getJSON, get} from '@resdir/http-client';
// import sleep from 'sleep-promise';

import Layout from '../layout';
import {ErrorBoundary, errorBoundary} from '../error-boundary';
import Loading from '../loading';
import {NavRoot, NavSection, NavItem} from './nav';
import Markdown from '../markdown';

const DOCS_BASE_URL = 'https://raw.githubusercontent.com/resdir/docs/master/content/';
const DOCS_INDEX_PATH = 'index.json';

@ErrorBoundary
@RadiumStarter
export class Docs extends React.Component {
  state = {
    contents: undefined,
    chapter: undefined,
    isLoading: true
  };

  componentDidMount() {
    this.load();
  }

  @errorBoundary
  async load() {
    const contents = await this._loadContents();
    const book = contents.books[0];
    const chapter = await this._loadChapter(book.chapters[0].path);
    this.setState({contents, chapter, isLoading: false});
  }

  async _loadContents() {
    const url = DOCS_BASE_URL + DOCS_INDEX_PATH;
    let {body: contents} = await getJSON(url);
    if (typeof contents === 'string') {
      contents = JSON.parse(contents);
    }
    return contents;
  }

  async _loadChapter(path) {
    const url = DOCS_BASE_URL + path;
    const {body: text} = await get(url);
    return {text};
  }

  render() {
    const t = this.theme;
    const s = this.styles;

    if (this.state.isLoading) {
      return <Loading />;
    }

    return (
      <Layout style={{alignItems: 'center'}}>
        <div
          style={{
            ...s.centeredPage,
            display: 'flex',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            [`@media (max-width: ${t.mediumBreakpointMinusOne})`]: {
              flexDirection: 'column'
            }
          }}
        >
          <Contents data={this.state.contents} style={{flexBasis: '18rem'}} />
          <Chapter
            data={this.state.chapter}
            style={{
              flexBasis: '42rem',
              [`@media (max-width: ${t.mediumBreakpointMinusOne})`]: {
                order: -1
              }
            }}
          />
        </div>
      </Layout>
    );
  }
}

export class Contents extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    data: PropTypes.object
  };

  render() {
    const {data} = this.props;
    if (!data) {
      return null;
    }

    return (
      <NavRoot style={this.props.style}>
        {data.books.map((book, index) => (
          <NavSection key={index} title={book.title}>
            {book.chapters.map((chapter, index) => <NavItem key={index} title={chapter.title} />)}
          </NavSection>
        ))}
      </NavRoot>
    );
  }
}

@RadiumStarter
export class Chapter extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    data: PropTypes.object
  };

  render() {
    const {data} = this.props;
    if (!data) {
      return null;
    }

    return (
      <div style={this.props.style}>
        <Markdown>{data.text}</Markdown>
      </div>
    );
  }
}

export default Docs;
