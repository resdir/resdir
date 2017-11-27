import React from 'react';
import PropTypes from 'prop-types';
import {RadiumStarter} from 'radium-starter';

@RadiumStarter
export class NavRoot extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    children: PropTypes.node.isRequired
  };

  render() {
    const s = this.styles;

    return (
      <nav style={this.props.style}>
        <ul style={{...s.unstyledList, ...s.noMargins}}>{this.props.children}</ul>
      </nav>
    );
  }
}

@RadiumStarter
export class NavSection extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired
  };

  render() {
    const t = this.theme;
    const s = this.styles;

    return (
      <li style={{marginBottom: '.5rem'}}>
        <span style={{color: t.headingsColor, fontWeight: t.headingsFontWeight}}>
          {this.props.title}
        </span>
        <ul style={{...s.unstyledList, ...s.noMargins, marginLeft: '1rem'}}>
          {this.props.children}
        </ul>
      </li>
    );
  }
}

@RadiumStarter
export class NavItem extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired
  };

  render() {
    return <li>{this.props.title}</li>;
  }
}
